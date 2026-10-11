/* ═══════════════════════════════════════════════════════════════════════
   ВЕРНИСАЖ — жидкая перламутровая скульптура (Three.js).

   Один модуль на два случая: живой холст на первом экране (js/hero3d.js)
   и офлайн-рендер картинок-фрагментов (tools/sculpt.html → tools/render.mjs).

   Форма: икосаэдр, который в вершинном шейдере растягивается, скручивается,
   прогибается «чашей», вытягивает каплю-хвост и медленно переливается
   3D-шумом. Нормали считаются там же — по соседним точкам, без пересчёта
   геометрии на процессоре. Цвет даёт только окружение: студия из лавандовых,
   розовых и голубых панелей + металл с плёночной иридесценцией.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.module.min.js';

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const DEFORM = /* glsl */`
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3  uSeed;
uniform vec3  uStretch;
uniform float uTwist;
uniform float uBend;
uniform vec3  uBowlDir;
uniform float uBowlR;
uniform float uBowlDepth;
uniform vec3  uTailDir;
uniform float uTailR;
uniform float uTailLen;
uniform vec3  uCrestDir;
uniform float uCrestR;
uniform float uCrestLen;
uniform float uDetail;

float bump(vec3 p, vec3 dir, float r){ float d = distance(p, normalize(dir)); return exp(-(d*d)/(r*r)); }

vec3 deform(vec3 p){
  vec3 n = normalize(p);
  /* медленное переливание: шум с временем + мелкая рябь поверх */
  float f1 = snoise(n*uFreq + uSeed + vec3(0.0, uTime, uTime*0.4));
  float f2 = snoise(n*uFreq*2.1 + uSeed.zxy*1.7 - vec3(uTime*0.55));
  /* мелкая рябь — много маленьких складок ловят блики, как на постере */
  float f3 = snoise(n*uFreq*3.2 + uSeed.yzx*2.3 + vec3(uTime*0.35, -uTime*0.25, 0.0));
  vec3 q = n * (1.0 + uAmp*f1 + uAmp*0.28*f2 + uDetail*f3);
  /* «чаша» — гладкая вогнутость спереди, «хвост» — капля вниз, «гребень» — загнутый край */
  q -= n * bump(n, uBowlDir, uBowlR) * uBowlDepth;
  /* вытягиваем по нормали, а не сдвигом в одну сторону: сдвиг складывает
     поверхность внахлёст, и в форме появляются дыры */
  q += n * bump(n, uTailDir, uTailR) * uTailLen;
  q += n * bump(n, uCrestDir, uCrestR) * uCrestLen;
  q *= uStretch;
  /* скрутка вокруг оси X и изгиб — перекрученные складки «застывшей волны» */
  float a = q.x * uTwist;
  float c = cos(a), s = sin(a);
  q.yz = mat2(c, s, -s, c) * q.yz;
  q.y += uBend * (q.x*q.x - 0.6);
  return q;
}
`;

export const VIEWS = {
  /* большая скульптура первого экрана; aspect — соотношение сторон блока на сайте */
  /* на сайте холст отражён по горизонтали (CSS scaleX(-1)): основная масса
     уходит за правый край, волна тянется влево — как на постере */
  hero: {
    aspect: 1.45, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [0.6, -0.6, 0.25], scale: 0.95, shift: [0.05, 0.02, 0],
    seed: [3.1, 7.7, 1.3]
  },
  /* фрагмент в левом нижнем углу первого экрана — обрезан краями */
  corner: {
    aspect: 1.25, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [0.7, 0.4, 0.2], scale: 0.85, shift: [0, 0, 0],
    seed: [9.4, 2.2, 5.8]
  },
  /* маленький фрагмент, который всплывает у строки оффера */
  chip: {
    aspect: 1.3, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [0.9, 2.6, -0.6], scale: 0.82, shift: [0, 0, 0],
    seed: [5.5, 1.1, 8.3]
  },
  /* левая колонка «О подборке» — вытянутый вверх фрагмент */
  about: {
    aspect: 0.8, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [-0.35, 0.9, 1.35], scale: 0.74, shift: [0, -0.1, 0],
    seed: [7.3, 3.9, 2.6]
  },
  /* последний призыв — крупный фрагмент над кнопкой */
  final: {
    aspect: 1.35, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [0.25, 2.2, -0.15], scale: 1.0, shift: [0, 0, 0],
    seed: [4.8, 8.8, 0.7]
  },
  /* угол подвала */
  foot: {
    aspect: 1.1, fov: 26, cam: [0, 0, 7.6], look: [0, 0, 0],
    rot: [1.2, -2.3, 0.5], scale: 1.12, shift: [-0.55, 0.5, 0],
    seed: [1.7, 6.6, 4.4]
  }
};

export const SHAPE = {
  amp: 0.26, freq: 0.8, speed: 0.15, detail: 0.022,
  stretch: [2.0, 1.15, 0.5], twist: 1.1, bend: 0.35,
  bowlDir: [0.25, 0.25, 1], bowlR: 0.9, bowlDepth: 0.55,
  tailDir: [-0.3, -1, 0.35], tailR: 0.28, tailLen: 0.85,
  crestDir: [-0.55, 0.85, 0.2], crestR: 0.35, crestLen: 0.5
};

/* Студия для отражений: свечение с градиентом + цветные «софтбоксы».
   Металл отражает только её — так задаётся вся палитра скульптуры. */
function studio(renderer, mode) {
  const scene = new THREE.Scene();
  const chrome = mode !== 'soft';
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: (chrome
        ? '#define TOPK 0.8\n#define MIDK 0.72\n#define HORK 0.85\n#define LOWK 0.4\n#define DEEPK 0.2\n'
        : '#define TOPK 1.1\n#define MIDK 1.0\n#define HORK 1.0\n#define LOWK 0.7\n#define DEEPK 0.4\n') + `varying vec3 vP;
        vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
        void main(){
          float y = vP.y;
          vec3 top = lin(vec3(0.94, 0.88, 1.0)) * TOPK;         /* светлая лаванда */
          vec3 mid = lin(vec3(0.75, 0.70, 0.87)) * MIDK;        /* #BEB8DE */
          vec3 hor = lin(vec3(0.69, 0.53, 0.81)) * HORK;        /* #B186CE */
          vec3 low = lin(vec3(0.39, 0.25, 0.50)) * LOWK;        /* #633F7F */
          vec3 deep = lin(vec3(0.26, 0.26, 0.44)) * DEEPK;      /* #424371 */
          vec3 c = y > 0.35 ? mix(mid, top, smoothstep(0.35, 0.95, y))
                 : y > -0.05 ? mix(hor, mid, smoothstep(-0.05, 0.35, y))
                 : y > -0.45 ? mix(low, hor, smoothstep(-0.45, -0.05, y))
                 : mix(deep, low, smoothstep(-0.95, -0.45, y));
          /* холодный голубой со стороны -X, тёплый персик со стороны +X */
          c = mix(c, lin(vec3(0.71, 0.80, 0.95)) * 1.1, smoothstep(0.2, 0.95, -vP.x) * 0.55);
          c = mix(c, lin(vec3(0.95, 0.82, 0.88)) * 1.1, smoothstep(0.3, 0.95, vP.x) * 0.45);
          gl_FragColor = vec4(c, 1.0);
        }`
    })
  );
  scene.add(sky);
  const panel = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); scene.add(m);
  };
  panel(9, 3.2, '#FFE5FF', 4.2, [0, 9, 3], [0, 0, 0]);       /* верхний софтбокс — почти белые блики */
  panel(1.1, 10, '#E4FCFE', 3.4, [-9, 1, 2], [0, 0, 0]);     /* левая полоса — циановые кромки */
  panel(0.7, 10, '#B5CDF1', 2.6, [-7, 0, -6], [0, 0, 0]);    /* сзади слева — голубой рефлекс */
  panel(0.6, 10, '#FFE5FF', 3.0, [-3, 0, -9], [0, 0, 0]);    /* тонкая белая полоса сзади */
  panel(1.4, 9, '#F3D1E1', 2.8, [9, 0.5, 1], [0, 0, 0]);     /* справа — розовый */
  panel(0.6, 9, '#FFE5FF', 2.6, [6, 0, -7], [0, 0, 0]);      /* сзади справа — белая полоса */
  panel(3, 1.6, '#E3C1BF', 2.0, [5, -5, 6], [0, 0, 0]);      /* снизу справа — персиковый отсвет */
  panel(5, 1.4, '#C58CD9', 1.8, [0, -2.5, 10], [0, 0, 0]);   /* спереди — орхидея */
  panel(0.8, 6, '#E4FCFE', 2.2, [-4, 2, 9], [0, 0, 0]);      /* спереди слева — циановая искра */
  if (chrome) {
    panel(14, 0.5, '#FFFFFF', 5.0, [0, 6, -6], [0, 0, 0]);    /* горизонт-блик сверху сзади */
    panel(0.35, 12, '#FFE5FF', 4.0, [-6, 0, 6], [0, 0, 0]);   /* узкая белая полоса слева спереди */
    panel(0.35, 12, '#E4FCFE', 3.6, [6.5, 0, 5], [0, 0, 0]);  /* узкая циановая справа спереди */
    panel(8, 0.4, '#F3D1E1', 3.0, [0, -3, 8], [0, 0, 0]);     /* розовая полоса снизу спереди */
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.012).texture;
  pmrem.dispose();
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return env;
}

export function createSculpture(canvas, opts = {}) {
  const view = Object.assign({}, VIEWS[opts.view || 'hero'], opts.viewOverride || {});
  const shape = Object.assign({}, SHAPE, opts.shape || {});
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, premultipliedAlpha: true,
    preserveDrawingBuffer: !!opts.preserve, powerPreference: opts.power || 'default'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(opts.dpr || 1);

  const scene = new THREE.Scene();
  scene.environment = studio(renderer, opts.env || 'chrome');

  const camera = new THREE.PerspectiveCamera(view.fov, view.aspect, 0.1, 100);
  camera.position.set(...view.cam);
  camera.lookAt(new THREE.Vector3(...view.look));

  const uniforms = {
    uTime: { value: opts.time || 0 },
    uAmp: { value: shape.amp }, uFreq: { value: shape.freq },
    uSeed: { value: new THREE.Vector3(...view.seed) },
    uStretch: { value: new THREE.Vector3(...shape.stretch) },
    uTwist: { value: shape.twist }, uBend: { value: shape.bend },
    uBowlDir: { value: new THREE.Vector3(...shape.bowlDir) }, uBowlR: { value: shape.bowlR }, uBowlDepth: { value: shape.bowlDepth },
    uTailDir: { value: new THREE.Vector3(...shape.tailDir) }, uTailR: { value: shape.tailR }, uTailLen: { value: shape.tailLen },
    uCrestDir: { value: new THREE.Vector3(...shape.crestDir) }, uCrestR: { value: shape.crestR }, uCrestLen: { value: shape.crestLen },
    uDetail: { value: shape.detail || 0 }
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.env === 'soft' ? '#E6DAFF' : '#DCCBFF'), metalness: 1, roughness: opts.env === 'soft' ? 0.05 : 0.035,
    iridescence: 1, iridescenceIOR: opts.env === 'soft' ? 1.6 : 1.8, iridescenceThicknessRange: [150, 900],
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.15,
    /* складки местами выворачиваются — изнанку тоже рисуем, иначе в форме дыры */
    side: THREE.DoubleSide
  });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + NOISE + DEFORM)
      .replace('#include <beginnormal_vertex>', `
        vec3 sp = normalize(position);
        vec3 tA = normalize(cross(sp, abs(sp.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 tB = cross(sp, tA);
        float e = 0.012;
        vec3 dp = deform(sp);
        vec3 dA = deform(normalize(sp + tA * e)) - dp;
        vec3 dB = deform(normalize(sp + tB * e)) - dp;
        vec3 objectNormal = normalize(cross(dA, dB));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = dp;');
  };

  const geo = new THREE.IcosahedronGeometry(1, opts.detail || 128);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.set(...view.rot);
  group.position.set(...view.shift);
  group.scale.setScalar(view.scale);
  if (view.mirror) group.scale.x *= -1;
  scene.add(group);

  /* два направленных света — короткие яркие блики поверх отражений */
  const k1 = new THREE.DirectionalLight('#FFE5FF', 1.4); k1.position.set(-2, 4, 5); scene.add(k1);
  const k2 = new THREE.DirectionalLight('#BFE9FF', 0.9); k2.position.set(4, -1, 3); scene.add(k2);

  const baseRot = group.rotation.clone();
  const baseScale = group.scale.clone();
  let px = 0, py = 0, spin = 0, intro = 1;

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function render(t) {
    uniforms.uTime.value = t * shape.speed;
    /* появление: из 0,82 размера с доворотом — «вливается» на место */
    const k = intro, e = 1 - Math.pow(1 - k, 3);
    group.scale.copy(baseScale).multiplyScalar(0.82 + 0.18 * e);
    group.rotation.set(baseRot.x + py, baseRot.y + spin + px + (1 - e) * 0.45, baseRot.z - (1 - e) * 0.15);
    renderer.render(scene, camera);
  }

  return {
    renderer, setSize, render,
    /* поворот от мыши/прокрутки в радианах (±3° = ±0.052) */
    setParallax(x, y) { px = x; py = y; },
    /* поворот вокруг вертикали, рад (js/hero3d.js качает его медленно) */
    setSpin(a) { spin = a; },
    /* 0 → 1: ход анимации появления */
    setIntro(k) { intro = Math.max(0, Math.min(1, k)); },
    dispose() { geo.dispose(); material.dispose(); scene.environment.dispose(); renderer.dispose(); }
  };
}
