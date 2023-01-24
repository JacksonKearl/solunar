export const radToDeg = (rad: number) => (rad * 180) / Math.PI
export const degToRad = (deg: number) => (deg * Math.PI) / 180

export const sin = (deg: number) => Math.sin(degToRad(deg))
export const asin = (val: number) => radToDeg(Math.asin(val))

export const cos = (deg: number) => Math.cos(degToRad(deg))
export const acos = (val: number) => radToDeg(Math.acos(val))

export const tan = (deg: number) => Math.tan(degToRad(deg))
export const atan = (val: number) => radToDeg(Math.atan(val))
export const atan2 = (x: number, y: number) => radToDeg(Math.atan2(y, x))

export const cot = (deg: number) => 1 / tan(deg)

export const wrap = (deg: number, limit = 360): number =>
	((deg % limit) + limit) % limit
