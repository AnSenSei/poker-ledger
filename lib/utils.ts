/**
 * 格式化日期 - 简短格式（首页列表用）
 * e.g. "2/22 周六"
 */
export function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

/**
 * 格式化日期 - 完整格式（详情页用）
 * e.g. "2025年2月22日 周六 20:00"
 */
export function formatDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });
}
