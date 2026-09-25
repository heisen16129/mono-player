// SPDX-License-Identifier: GPL-3.0-only
import { createController } from './controller.mjs';
let controller;
export default {
  mount(root, api) { controller?.destroy(); controller = createController(root, api); },
  update(message) { controller?.update(message); },
  destroy() { controller?.destroy(); controller = undefined; },
};
