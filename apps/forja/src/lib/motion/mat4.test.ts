import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  I4,
  apply,
  compose,
  deg,
  latticeRest,
  multiply,
  ortho,
  perspective,
  project,
  rotateX,
  rotateY,
  affineOp,
  isAffine,
  tiltMatrix,
  toCss,
  translate,
} from "./mat4.ts";

describe("mat4", () => {
  it("keeps the identity product", () => {
    const t = translate(10, -4, 3);
    assert.deepEqual(multiply(I4, t), t);
    assert.deepEqual(multiply(t, I4), t);
  });

  it("rotateX(90°) maps +Y to +Z", () => {
    const p = apply(rotateX(Math.PI / 2), [0, 1, 0, 1]);
    assert.ok(Math.abs(p[0]) < 1e-9);
    assert.ok(Math.abs(p[1]) < 1e-9);
    assert.ok(Math.abs(p[2] - 1) < 1e-9);
    assert.equal(p[3], 1);
  });

  it("compose applies right to left", () => {
    const m = compose(translate(0, 0, 10), rotateY(deg(90)));
    const p = apply(m, [1, 0, 0, 1]);
    assert.ok(Math.abs(p[0]) < 1e-9);
    assert.ok(Math.abs(p[2] - 9) < 1e-9);
  });

  it("emits CSS matrix3d column-major", () => {
    assert.equal(toCss(I4), "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
    assert.match(toCss(tiltMatrix(0.5, -0.25)), /^matrix3d\(/);
  });

  it("fans the lattice in yaw without mirroring", () => {
    const a = apply(latticeRest(0), [0, 0, 0, 1]);
    const b = apply(latticeRest(3), [0, 0, 0, 1]);
    assert.ok(a[2] > 0 && b[2] > 0);
    assert.notEqual(toCss(latticeRest(0)), toCss(latticeRest(3)));
  });

  it("orthographic projection keeps X/Y independent of Z", () => {
    const P = ortho(-2, 2, -2, 2, 0.1, 100);
    const near = project(P, [1, 0.5, -5]);
    const far = project(P, [1, 0.5, -40]);
    assert.equal(near.w, 1);
    assert.equal(far.w, 1);
    assert.ok(Math.abs(near.x - far.x) < 1e-9);
    assert.ok(Math.abs(near.y - far.y) < 1e-9);
    assert.notEqual(near.z, far.z);
  });

  it("perspective projection shrinks X/Y as Z recedes", () => {
    const P = perspective(0.1, 100);
    const near = project(P, [1, 0.5, -5]);
    const far = project(P, [1, 0.5, -40]);
    assert.ok(Math.abs(near.w - 5) < 1e-9);
    assert.ok(Math.abs(far.w - 40) < 1e-9);
    assert.ok(Math.abs(far.x) < Math.abs(near.x));
    assert.ok(Math.abs(far.y) < Math.abs(near.y));
  });

  it("T, R, S, shear and their product are affine; perspective is not", () => {
    for (const kind of ["identity", "translate", "rotate", "scale", "shear", "compose"] as const) {
      assert.equal(isAffine(affineOp(kind)), true);
    }
    assert.equal(isAffine(ortho(-1, 1, -1, 1, 0.1, 10)), true);
    assert.equal(isAffine(perspective(0.1, 100)), false);
  });

  it("an affine map preserves midpoints", () => {
    const m = affineOp("compose");
    const a: [number, number, number, number] = [0, 0, 0, 1];
    const b: [number, number, number, number] = [4, 2, -2, 1];
    const mid: [number, number, number, number] = [2, 1, -1, 1];
    const pa = apply(m, a);
    const pb = apply(m, b);
    const pm = apply(m, mid);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(pm[i] - (pa[i] + pb[i]) / 2) < 1e-9);
    }
  });
});
