use super::sampling::{CropSpec, PixelBounds};
use std::hash::{DefaultHasher, Hasher};
use windows::{
    core::{factory, Interface, Result},
    Graphics::{
        Capture::*,
        DirectX::{Direct3D11::IDirect3DDevice, DirectXPixelFormat},
        SizeInt32,
    },
    Win32::{
        Foundation::{HMODULE, HWND},
        Graphics::{Direct3D::D3D_DRIVER_TYPE_HARDWARE, Direct3D11::*, Dxgi::IDXGIDevice},
        System::WinRT::{Direct3D11::*, Graphics::Capture::IGraphicsCaptureItemInterop},
    },
};

// Only the optional control-bar sampler is copied to the CPU. The main
// wallpaper stays on the native DWM/GPU path at the engine's own frame rate.
pub(super) struct Capture {
    pool: Direct3D11CaptureFramePool,
    session: GraphicsCaptureSession,
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    runtime_device: IDirect3DDevice,
    size: SizeInt32,
    staging: Option<ID3D11Texture2D>,
}

impl Capture {
    pub(super) fn new(window: HWND) -> Result<Self> {
        unsafe {
            let interop: IGraphicsCaptureItemInterop = factory::<GraphicsCaptureItem, _>()?;
            let item: GraphicsCaptureItem = interop.CreateForWindow(window)?;
            let mut device = None;
            let mut context = None;
            D3D11CreateDevice(
                None,
                D3D_DRIVER_TYPE_HARDWARE,
                HMODULE::default(),
                D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&mut device),
                None,
                Some(&mut context),
            )?;
            let device = device.unwrap();
            let context = context.unwrap();
            let dxgi: IDXGIDevice = device.cast()?;
            let runtime_device: IDirect3DDevice =
                CreateDirect3D11DeviceFromDXGIDevice(&dxgi)?.cast()?;
            let size = item.Size()?;
            let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
                &runtime_device,
                DirectXPixelFormat::B8G8R8A8UIntNormalized,
                2,
                size,
            )?;
            let session = pool.CreateCaptureSession(&item)?;
            let _ = session.SetIsCursorCaptureEnabled(false);
            let _ = session.SetIsBorderRequired(false);
            session.StartCapture()?;
            Ok(Self {
                pool,
                session,
                device,
                context,
                runtime_device,
                size,
                staging: None,
            })
        }
    }

    pub(super) fn frame(&mut self, crop: Option<CropSpec>) -> Result<Option<Vec<u8>>> {
        let Ok(frame) = self.pool.TryGetNextFrame() else {
            return Ok(None);
        };
        let size = frame.ContentSize()?;
        if size.Width <= 0 || size.Height <= 0 {
            return Ok(None);
        }
        if size.Width != self.size.Width || size.Height != self.size.Height {
            frame.Close()?;
            self.pool.Recreate(
                &self.runtime_device,
                DirectXPixelFormat::B8G8R8A8UIntNormalized,
                2,
                size,
            )?;
            self.size = size;
            self.staging = None;
            return Ok(None);
        }
        unsafe {
            let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
            let texture: ID3D11Texture2D = access.GetInterface()?;
            let mut desc = D3D11_TEXTURE2D_DESC::default();
            texture.GetDesc(&mut desc);
            if self.staging.is_none() {
                desc.Usage = D3D11_USAGE_STAGING;
                desc.BindFlags = 0;
                desc.MiscFlags = 0;
                desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ.0 as u32;
                self.device
                    .CreateTexture2D(&desc, None, Some(&mut self.staging))?;
            }
            let staging = self.staging.as_ref().unwrap();
            self.context.CopyResource(staging, &texture);
            let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
            self.context
                .Map(staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;
            let width = (size.Width as u32).min(desc.Width);
            let height = (size.Height as u32).min(desc.Height);
            let bounds = crop
                .map(|crop| crop.pixel_bounds(width, height))
                .unwrap_or(PixelBounds {
                    left: 0,
                    top: 0,
                    width,
                    height,
                });
            let sampled_width = bounds.width.min(1600);
            let sampled_height = (bounds.height * sampled_width / bounds.width).max(1);
            let pixels = std::slice::from_raw_parts(
                mapped.pData as *const u8,
                mapped.RowPitch as usize * height as usize,
            );
            let mut rgb = image::RgbImage::new(sampled_width, sampled_height);
            for (x, y, pixel) in rgb.enumerate_pixels_mut() {
                let source_y = bounds.top + y * bounds.height / sampled_height;
                let source_x = bounds.left + x * bounds.width / sampled_width;
                let offset = source_y as usize * mapped.RowPitch as usize + source_x as usize * 4;
                *pixel = image::Rgb([pixels[offset + 2], pixels[offset + 1], pixels[offset]]);
            }
            self.context.Unmap(staging, 0);
            frame.Close()?;
            let mut bytes = Vec::new();
            if image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 88)
                .encode_image(&rgb)
                .is_err()
            {
                return Ok(None);
            }
            Ok(Some(bytes))
        }
    }

    pub(super) fn signature(&mut self) -> Result<Option<u64>> {
        let Ok(frame) = self.pool.TryGetNextFrame() else {
            return Ok(None);
        };
        let size = frame.ContentSize()?;
        if size.Width <= 0 || size.Height <= 0 {
            return Ok(None);
        }
        if size.Width != self.size.Width || size.Height != self.size.Height {
            frame.Close()?;
            self.pool.Recreate(
                &self.runtime_device,
                DirectXPixelFormat::B8G8R8A8UIntNormalized,
                2,
                size,
            )?;
            self.size = size;
            self.staging = None;
            return Ok(None);
        }
        unsafe {
            let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
            let texture: ID3D11Texture2D = access.GetInterface()?;
            let mut desc = D3D11_TEXTURE2D_DESC::default();
            texture.GetDesc(&mut desc);
            if self.staging.is_none() {
                desc.Usage = D3D11_USAGE_STAGING;
                desc.BindFlags = 0;
                desc.MiscFlags = 0;
                desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ.0 as u32;
                self.device
                    .CreateTexture2D(&desc, None, Some(&mut self.staging))?;
            }
            let staging = self.staging.as_ref().unwrap();
            self.context.CopyResource(staging, &texture);
            let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
            self.context
                .Map(staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;
            let width = (size.Width as u32).min(desc.Width);
            let height = (size.Height as u32).min(desc.Height);
            let pixels = std::slice::from_raw_parts(
                mapped.pData as *const u8,
                mapped.RowPitch as usize * height as usize,
            );
            let mut signature = DefaultHasher::new();
            for y in 0..14 {
                for x in 0..24 {
                    let source_y = y * height / 14;
                    let source_x = x * width / 24;
                    let offset =
                        source_y as usize * mapped.RowPitch as usize + source_x as usize * 4;
                    signature.write(&pixels[offset..offset + 3]);
                }
            }
            self.context.Unmap(staging, 0);
            frame.Close()?;
            Ok(Some(signature.finish()))
        }
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        let _ = self.session.Close();
        let _ = self.pool.Close();
    }
}
