/** Таймкод пользователя: секунды, ММ:СС или ЧЧ:ММ:СС. */
export function parseClipTime(text) {
  const s=String(text).trim().replace(',', '.');
  if(!s || !/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(s))return null;
  const parts=s.split(':').map(Number);
  if(parts.length>1 && parts.slice(1).some(n=>n>=60))return null;
  return parts.reduce((total,n)=>total*60+n,0);
}
export function formatClipTime(value) {
  const rounded=Math.round(Math.max(0,value)*100)/100, minutes=Math.floor(rounded/60), sec=rounded-minutes*60;
  return `${minutes}:${sec.toFixed(2).padStart(5,'0').replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')}`;
}
export function validateClipRange(start,end,duration) {
  return Number.isFinite(start)&&Number.isFinite(end)&&Number.isFinite(duration)&&start>=0&&end>start&&end<=duration+.001;
}
export function clipTarget(elapsed,start,end) {
  return start+Math.min(Math.max(0,elapsed),Math.max(0,end-start-1/30));
}
export function sourceRange(label,duration) {
  const parts=label.split(/[–—-]/),start=parseClipTime(parts[0]),end=parts.length>1?parseClipTime(parts[1]):duration;
  return validateClipRange(start,end,duration)?{start,end:Math.min(end,duration)}:null;
}
