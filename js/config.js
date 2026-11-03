// js/config.js —— 服务端参数（规格书 2.5：所有限制值都从这里读，不许写死）
//
// 接口：GET /api/config（不需要登录）
// 目的：整站只请求一次，之后都从内存里拿。
// 用法：const config = await getConfig();  然后 config.maxSeatsPerSession ...

import { request } from './api.js';

// 存配置的地方。null 表示"还没拿过"
let cachedConfig = null;

export async function getConfig() {
  if (cachedConfig !== null) {
    return cachedConfig; // 拿过了，直接给，不再发请求
  }

  cachedConfig = await request('/config', { auth: false });
  return cachedConfig;
}
