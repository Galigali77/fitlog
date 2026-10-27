/**
 * 全局轻量 Toast 通知（写操作错误处理的用户感知层）
 * 模块级事件总线 + App 内挂载的 <ToastHost /> 渲染，任何层级都能 toast() 一行触发。
 */

const listeners = new Set();
let seq = 0;

/**
 * 弹出一条通知（4 秒后自动消失，最多同时保留 3 条）
 * @param {string} message
 */
export function toast(message) {
  const item = { id: ++seq, message: String(message) };
  listeners.forEach((fn) => fn(item));
}

/**
 * 订阅通知（ToastHost 用）
 * @param {(item: { id: number, message: string }) => void} fn
 * @returns {() => void} 取消订阅
 */
export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 把 IndexedDB/Dexie 异常翻译成人话
 * @param {unknown} err
 * @returns {string}
 */
export function describeDbError(err) {
  const name = err?.name ?? '';
  const msg = err?.message ?? '';
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return '存储空间不足，请先到「设置」导出备份，再清理浏览器数据';
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || /denied|private/i.test(msg)) {
    return '浏览器处于隐私/无痕模式，禁止本地写入，请改用正常窗口';
  }
  return msg || '未知错误';
}

/**
 * 包裹一次写操作：失败时 toast 提示
 * @param {string} label 操作名，如「保存训练」
 * @param {() => Promise<any>} fn
 * @returns {Promise<boolean>} 是否成功（调用方据此决定是否继续后续流程）
 */
export async function tryWrite(label, fn) {
  try {
    await fn();
    return true;
  } catch (err) {
    toast(`${label}失败：${describeDbError(err)}`);
    return false;
  }
}
