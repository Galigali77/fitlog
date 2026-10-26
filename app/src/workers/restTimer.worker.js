/**
 * 休息计时器 Web Worker（阶段三：计时器后台保活加固）
 * 手机浏览器会挂起后台标签页的主线程定时器，Worker 线程的节流宽松得多，
 * 因此把读秒循环放进 Worker：按 endAt 差值每 250ms 回报剩余秒数，
 * 即使主线程被冻结，回前台时剩余时间依然准确。
 *
 * 消息协议：
 *   接收 { type: 'start', endAt }  开始/重置读秒
 *   接收 { type: 'stop' }          停止
 *   发送 { left }                  剩余秒数（到时后持续发 0 直至 stop）
 */

let timer = null; // setInterval 句柄
let endAt = 0; // 结束时刻（epoch ms）

self.onmessage = (e) => {
  const { type } = e.data ?? {};
  if (type === 'start') {
    endAt = e.data.endAt;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      self.postMessage({ left });
    }, 250);
  } else if (type === 'stop') {
    if (timer) clearInterval(timer);
    timer = null;
  }
};
