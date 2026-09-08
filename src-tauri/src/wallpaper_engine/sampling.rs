#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct CropSpec {
    pub left: f32,
    pub top: f32,
    pub width: f32,
    pub height: f32,
    pub viewport_width: f32,
    pub viewport_height: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct PixelBounds {
    pub left: u32,
    pub top: u32,
    pub width: u32,
    pub height: u32,
}

impl CropSpec {
    pub(super) fn from_query(query: Option<&str>) -> Option<Self> {
        let mut values = [None; 6];
        for pair in query?.split('&') {
            let (key, value) = pair.split_once('=')?;
            let slot = match key {
                "left" => 0,
                "top" => 1,
                "width" => 2,
                "height" => 3,
                "viewportWidth" => 4,
                "viewportHeight" => 5,
                _ => continue,
            };
            values[slot] = value.parse::<f32>().ok().filter(|value| value.is_finite());
        }
        let crop = Self {
            left: values[0]?,
            top: values[1]?,
            width: values[2]?,
            height: values[3]?,
            viewport_width: values[4]?,
            viewport_height: values[5]?,
        };
        (crop.width >= 1.0
            && crop.height >= 1.0
            && crop.viewport_width >= 2.0
            && crop.viewport_height >= 2.0)
            .then_some(crop)
    }

    pub(super) fn pixel_bounds(self, frame_width: u32, frame_height: u32) -> PixelBounds {
        let scale_x = frame_width as f32 / self.viewport_width;
        let scale_y = frame_height as f32 / self.viewport_height;
        let left = (self.left * scale_x)
            .floor()
            .clamp(0.0, frame_width.saturating_sub(1) as f32) as u32;
        let top = (self.top * scale_y)
            .floor()
            .clamp(0.0, frame_height.saturating_sub(1) as f32) as u32;
        let right = ((self.left + self.width) * scale_x)
            .ceil()
            .clamp((left + 1).min(frame_width) as f32, frame_width as f32)
            as u32;
        let bottom = ((self.top + self.height) * scale_y)
            .ceil()
            .clamp((top + 1).min(frame_height) as f32, frame_height as f32)
            as u32;
        PixelBounds {
            left,
            top,
            width: right.saturating_sub(left).max(1),
            height: bottom.saturating_sub(top).max(1),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sampler_geometry() {
        let crop = CropSpec::from_query(Some(
            "frame=8&left=120.5&top=700&width=1000&height=110&viewportWidth=1440&viewportHeight=900",
        ))
        .unwrap();
        assert_eq!(crop.left, 120.5);
        assert_eq!(crop.height, 110.0);
    }

    #[test]
    fn maps_css_geometry_to_capture_pixels() {
        let crop = CropSpec {
            left: 100.0,
            top: 700.0,
            width: 1000.0,
            height: 100.0,
            viewport_width: 1440.0,
            viewport_height: 900.0,
        };
        assert_eq!(
            crop.pixel_bounds(1800, 1125),
            PixelBounds {
                left: 125,
                top: 875,
                width: 1250,
                height: 125,
            }
        );
    }

    #[test]
    fn clips_geometry_to_capture_bounds() {
        let crop = CropSpec {
            left: -20.0,
            top: 80.0,
            width: 160.0,
            height: 60.0,
            viewport_width: 100.0,
            viewport_height: 100.0,
        };
        assert_eq!(
            crop.pixel_bounds(200, 200),
            PixelBounds {
                left: 0,
                top: 160,
                width: 200,
                height: 40,
            }
        );
    }
}
