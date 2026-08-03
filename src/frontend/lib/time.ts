export const formatRelativeTime = (timestamp: number, now = Date.now()): string => {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return "たった今";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(timestamp).toLocaleDateString();
};

export const formatAbsoluteTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString();

// heartbeat がこの間隔以内なら「接続中」とみなす
export const HEARTBEAT_FRESH_MS = 2 * 60 * 1000;
