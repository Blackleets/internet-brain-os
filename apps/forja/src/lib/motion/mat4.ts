/** Column-major 4×4, same layout as CSS matrix3d(). */

export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const I4: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export function deg(n: number) {
  return (n * Math.PI) / 180;
}

export function identity(): Mat4 {
  return I4.slice() as Mat4;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = identity();
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

export function compose(...mats: Mat4[]): Mat4 {
  return mats.reduceRight((acc, m) => multiply(m, acc), identity());
}

export function translate(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function rotateX(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ];
}

export function rotateY(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ];
}

export function rotateZ(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function scale(x: number, y: number, z: number): Mat4 {
  return [
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ];
}

/** Homogeneous shear in XY (used as a strike accent, not a camera). */
export function shear(xy: number, xz: number): Mat4 {
  return [
    1, 0, 0, 0,
    xy, 1, 0, 0,
    xz, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function apply(m: Mat4, v: [number, number, number, number?]): [number, number, number, number] {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const w = v[3] ?? 1;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

export function toCss(m: Mat4): string {
  return `matrix3d(${m.map((n) => Number(n.toFixed(6))).join(",")})`;
}

export function tiltMatrix(nx: number, ny: number, maxDeg = 8, z = 0): Mat4 {
  const rx = deg(-ny * maxDeg);
  const ry = deg(nx * maxDeg);
  return compose(translate(0, 0, z), rotateY(ry), rotateX(rx));
}

export function latticeRest(index: number, total = 4): Mat4 {
  const t = total === 1 ? 0 : index / (total - 1);
  const yaw = deg(-8 + t * 16);
  const pitch = deg(8);
  const z = 16 - Math.abs(t - 0.5) * 16;
  return compose(translate(0, 0, z), rotateY(yaw), rotateX(pitch));
}

export function project(m: Mat4, v: [number, number, number]): { x: number; y: number; z: number; w: number } {
  const [x, y, z, w] = apply(m, [v[0], v[1], v[2], 1]);
  if (Math.abs(w) < 1e-12) return { x, y, z, w };
  return { x: x / w, y: y / w, z: z / w, w };
}

export function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
  const m = identity();
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = -2 / (far - near);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = -(far + near) / (far - near);
  return m;
}

export function perspective(near: number, far: number, fovY = Math.PI / 4, aspect = 1): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
}

export type ProjectionKind = "perspective" | "ortho";

export type AffineKind = "identity" | "translate" | "rotate" | "scale" | "shear" | "compose";

export function isAffine(m: Mat4, eps = 1e-9): boolean {
  return (
    Math.abs(m[3]) < eps &&
    Math.abs(m[7]) < eps &&
    Math.abs(m[11]) < eps &&
    Math.abs(m[15] - 1) < eps
  );
}

export function affineOp(kind: AffineKind): Mat4 {
  const T = translate(10, -6, 8);
  const R = rotateZ(deg(12));
  const S = scale(1.08, 0.92, 1);
  const H = shear(0.18, 0.04);
  if (kind === "translate") return T;
  if (kind === "rotate") return R;
  if (kind === "scale") return S;
  if (kind === "shear") return H;
  if (kind === "compose") return compose(T, R, S, H);
  return identity();
}

export const IDENTITY_CSS = toCss(I4);


