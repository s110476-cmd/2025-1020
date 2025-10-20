// --- 圓的設定 ---
let circles = [];
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
const NUM_CIRCLES = 20;

// 新增：粒子系統
let particles = [];

// 新增：簡單的 Web Audio 合成爆破音效（不需額外檔案）
let audioCtx = null;
let popBuffer = null;

// 新增：表示使用者是否已解鎖音效（點擊畫面）
let audioUnlocked = false;

// 新增：外部音檔路徑（請從 Pixabay 下載並放到專案 assets 資料夾）
let popUrl = 'assets/pop-402323.mp3'; // <-- 下載後放在 c:\Users\User\Downloads\20251013\assets\pop-402323.mp3

// 新增：分數
let score = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  // 初始化圓
  circles = [];
  for (let i = 0; i < NUM_CIRCLES; i++) {
    let colHex = random(COLORS);
    circles.push({
      x: random(width),
      y: random(height),
      r: random(50, 200),
      color: color(colHex),
      colHex: colHex,
      alpha: random(80, 255),
      speed: random(1, 5),
      popped: false,        // 是否已爆破
      popRiseRemaining: 0   // 爆破後還要向上飄多少像素
    });
  }
}

// 初始化並建立短暫 noise buffer
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // 0.18 秒的 noise，帶快速指數衰減
  let len = Math.floor(audioCtx.sampleRate * 0.18);
  let buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  let d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // 隨機雜訊並加上衰減，產生爆破感
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  popBuffer = buf;
}

// 播放合成爆破音
function playPopSound() {
  initAudio();
  if (!audioCtx || !popBuffer) return;
  // 在需要的時候 resume（某些瀏覽器需要在使用者互動後才能播放）
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(()=>{/*忽略錯誤*/});
  }
  let src = audioCtx.createBufferSource();
  src.buffer = popBuffer;

  // 加一點 bandpass 以模擬短促爆破音的頻率集中
  let bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500 + Math.random() * 800; // 頻率稍微隨機
  bp.Q.value = 1.2;

  // 包一個快速衰減的 gain
  let g = audioCtx.createGain();
  g.gain.value = 0.9;

  src.connect(bp);
  bp.connect(g);
  g.connect(audioCtx.destination);

  src.start(0);
}

// 從外部 URL 載入並 decode 成 AudioBuffer（若失敗保留合成音）
async function loadPopFromUrl(url) {
  try {
    if (!audioCtx) initAudio();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Network response not ok: ' + resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    // decodeAudioData 回傳可能採用 callback 或 promise，這裡用 promise 風格
    popBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log('外部爆破音載入完成:', url);
  } catch (e) {
    console.warn('載入外部音檔失敗，保留合成音 fallback。錯誤：', e);
    // 若尚未建立 synth buffer，建立 fallback
    if (!popBuffer) initAudio();
  }
}

function draw() {
  background('#fcf6bd');
  noStroke();

  // 左上顯示固定文字
  push();
  fill('#ccd5ae');
  noStroke();
  textSize(32);
  textAlign(LEFT, TOP);
  text('414730340', 10, 10);
  pop();

  // 右上顯示分數
  push();
  fill('#ccd5ae');
  noStroke();
  textSize(32);
  textAlign(RIGHT, TOP);
  text(score, width - 10, 10);
  pop();

  // 若尚未解鎖音效，繪製提示（改為中間小提示框，不再覆蓋整畫面）
  if (!audioUnlocked) {
    push();
    let boxW = min(420, width * 0.8);
    let boxH = 110;
    let boxX = (width - boxW) / 2;
    let boxY = (height - boxH) / 2;

    // 半透明白色背景，微陰影
    fill(255, 230);
    stroke(0, 40);
    strokeWeight(1.5);
    rectMode(CORNER);
    rect(boxX, boxY, boxW, boxH, 12);

    // 文字提示
    noStroke();
    fill(30);
    textAlign(CENTER, CENTER);
    textSize(22);
    text('請點擊畫面開始音效', width / 2, height / 2 - 8);
    textSize(14);
    fill(80);
    text('或點擊任意處以解鎖音訊裝置', width / 2, height / 2 + 28);
    pop();
  }

  // 更新與繪製每個圓（移除自動隨機爆破）
  for (let c of circles) {
    // 若氣球已爆破，讓它向上額外飄動一段距離後重生
    if (c.popped) {
      if (c.popRiseRemaining > 0) {
        // 平滑向上移動（總共向上 10 像素）
        let step = min(0.6, c.popRiseRemaining);
        c.y -= step;
        c.popRiseRemaining -= step;
      } else {
        // 當向上飄完，從底部重設（像原本離開畫面後重生一樣）
        respawnCircle(c);
      }
    } else {
      // 正常向上移動
      c.y -= c.speed;
      if (c.y + c.r / 2 < 0) { // 如果圓完全移出畫面頂端
        c.y = height + c.r / 2;  // 從底部重新出現
        c.x = random(width);
        c.r = random(50, 200);
        c.colHex = random(COLORS);
        c.color = color(c.colHex);
        c.alpha = random(80, 255);
        c.speed = random(1, 5);
      }
    }

    // 繪製氣球（若已爆破就不繪製實心圓）
    if (!c.popped) {
      c.color.setAlpha(c.alpha); // 設定透明度
      fill(c.color); // 使用設定的顏色
      circle(c.x, c.y, c.r); // 畫圓

      // 在圓的右上方1/4圓的中間產生方形
      let squareSize = c.r / 6;
      // 右上1/4圓的中間點：圓心往右上45度方向移動 r/2 * sqrt(2)/2
      let angle = -PI / 4; // 右上45度
      let distance = c.r / 2 * 0.65; // 1/4圓的中間，距離圓心 r/2 * 0.5
      let squareCenterX = c.x + cos(angle) * distance;
      let squareCenterY = c.y + sin(angle) * distance;
      fill(255, 255, 255, 120); // 白色透明
      noStroke();
      rectMode(CENTER);
      rect(squareCenterX, squareCenterY, squareSize, squareSize);
    }
  }

  // 更新並繪製粒子
  updateAndDrawParticles();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新分布圓的位置
  for (let c of circles) {
    c.x = random(width);
    c.y = random(height);
  }
}

// ----------------------
// 爆破與粒子相關函式
// ----------------------

// 觸發爆破：建立粒子，設定氣球為已爆破並開始向上飄 10 像素
function triggerPop(circle) {
  circle.popped = true;
  circle.popRiseRemaining = 10; // 向上再飄 10 像素

  // 播放爆破音（使用合成音）
  playPopSound();

  // 建立粒子（數量依半徑大小調整）
  let count = floor(map(circle.r, 50, 200, 10, 30));
  let baseR = red(circle.color);
  let baseG = green(circle.color);
  let baseB = blue(circle.color);

  for (let i = 0; i < count; i++) { 
    let speed = random(1, 5);
    let angle = random(TWO_PI);
    particles.push({
      x: circle.x + cos(angle) * random(0, circle.r * 0.3),
      y: circle.y + sin(angle) * random(0, circle.r * 0.3),
      vx: cos(angle) * speed + random(-1, 1),
      vy: sin(angle) * speed + random(-1, 1) - 0.5, // 微向上偏移
      life: random(30, 70),
      maxLife: 0,
      r: random(3, 8),
      color: [baseR, baseG, baseB]
    });
    particles[particles.length-1].maxLife = particles[particles.length-1].life;
  }
}

// 更新並繪製粒子
function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    // 更新
    p.x += p.vx;
    p.y += p.vy;
    p.vy += -0.02; // 少量向上的加速度，讓碎片看起來往上散
    p.life -= 1;

    // 繪製
    let alpha = map(p.life, 0, p.maxLife, 0, 255);
    fill(p.color[0], p.color[1], p.color[2], alpha);
    noStroke();
    ellipse(p.x, p.y, p.r);

    // 移除已結束的粒子
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// 重生氣球（從底部重新產生，恢復屬性）
function respawnCircle(c) {
  c.x = random(width);
  c.y = height + c.r / 2;
  c.r = random(50, 200);
  c.colHex = random(COLORS);
  c.color = color(c.colHex);
  c.alpha = random(80, 255);
  c.speed = random(1, 5);
  c.popped = false;
  c.popRiseRemaining = 0;
}

// 檢查點擊是否在某氣球內並處理得分與爆破
function handleClickAt(x, y) {
  // 從最後一個（畫面上層）開始檢查
  for (let i = circles.length - 1; i >= 0; i--) {
    let c = circles[i];
    if (!c.popped) {
      let d = dist(x, y, c.x, c.y);
      if (d <= c.r / 2) {
        // 點中氣球
        if (c.colHex.toLowerCase() === '#ffca3a') {
          score += 1;
        } else {
          score -= 1;
        }
        triggerPop(c);
        return true;
      }
    }
  }
  return false;
}

// 使用者互動以解鎖/初始化音訊（mouse + touch 支援）
// 修改為：解鎖後嘗試從 popUrl 載入外部音檔，並且處理點擊觸發氣球爆破
function mousePressed() {
  if (!audioUnlocked) {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(()=>{});
    }
    audioUnlocked = true;
    // 非同步載入外部音檔（若成功會取代合成音）
    loadPopFromUrl(popUrl);
  }
  handleClickAt(mouseX, mouseY);
}

function touchStarted() {
  if (!audioUnlocked) {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(()=>{});
    }
    audioUnlocked = true;
    loadPopFromUrl(popUrl);
  }
  // 若為多指觸控，使用第一個觸點
  let tx = (touches && touches.length) ? touches[0].x : mouseX;
  let ty = (touches && touches.length) ? touches[0].y : mouseY;
  handleClickAt(tx, ty);
  // 防止 touch 造成預設行為（在某些環境）
  return false;
}