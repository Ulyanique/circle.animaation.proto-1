// Режиссёрские точки цикла: по ним сверяют тайминги в тестах и проверках.
// DOM-панель режиссёрского просмотра убрана: её функции целиком закрыл
// визуальный редактор и пульт, а панель дублировала их и не подключалась.
export function reviewMarkers(tl) {
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration, F = tl.fadeDuration;
  return [
    { label: "Точка", time: Math.min(0.5, D * 0.2) },
    { label: "Передача", time: D * 0.87 },
    { label: "Контур", time: D + E * 0.08 },
    { label: "Золото", time: D + E * 0.65 },
    { label: "Блик", time: D + E + Math.min(0.58, H * 0.08) },
    { label: "Композиция", time: D + E + H * 0.55 },
    { label: "Уход", time: D + E + H + F * 0.92 },
  ];
}

