export const euro = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
export const euroRate = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en-IE', { maximumFractionDigits: 1 }).format(value);
export function flag(country: string | null) {
  return country && /^[A-Z]{2}$/.test(country) ? String.fromCodePoint(...[...country].map(c => 127397+c.charCodeAt(0))) : '';
}
export function tomorrow() {
  const date = new Date(); date.setUTCDate(date.getUTCDate()+1); return date.toISOString().slice(0,10);
}
export function updatedText(time: string | null, now = Date.now()) {
  if (!time) return 'Awaiting first update';
  const minutes = Math.max(0, Math.floor((now-new Date(time).getTime())/60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  if (minutes < 1440) return `Updated ${Math.floor(minutes/60)} h ago`;
  return `Updated ${Math.floor(minutes/1440)} days ago`;
}
