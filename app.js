// ====== 基本狀態（不存檔 / Session-based） ======
const state = {
  kid: null, // {id, name, emoji}
  stage: { grade: null, term: null, phase: null },
  packsIndex: null, // loaded from /packs/index.json
  selectedPack: null, // index entry
  packData: null, // loaded pack JSON {meta, questions}
  session: null // {questions[], i, correct, parts}
};

const DUNGEONS = [
  { id: "chinese_forest", name: "文字魔法森林", icon: "🌲", desc: "讀音/部首/筆劃/相似字（選擇題）" },
  { id: "math_mine",      name: "數字金礦場",   icon: "⛏️", desc: "1000 內＋四則（選擇/填空）" },
  { id: "social_village", name: "社會生活村",   icon: "🏘️", desc: "施工中（之後加題包就開）" },
  { id: "english_island", name: "英語探險島",   icon: "🏝️", desc: "施工中（之後加題包就開）" },
  { id: "science_lab",    name: "自然實驗所",   icon: "🧪", desc: "施工中（之後加題包就開）" },
  { id: "idiom_theater",  name: "成語小劇場",   icon: "🎭", desc: "施工中（之後加題包就開）" },
  { id: "sentence_diary", name: "造句日記站",   icon: "📓", desc: "施工中（之後加題包就開）" }
];

const PHASE_LABEL = { practice: "平時", midterm: "期中", final: "期末" };

// ====== DOM helpers ======
const $ = (id) => document.getElementById(id);
function show(screenId){
  const screens = ["screen-home","screen-dungeons","screen-run","screen-admin"];
  for(const s of screens){
    $(s).classList.toggle("hidden", s !== screenId);
  }
  window.scrollTo({top:0, behavior:"instant"});
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ====== Load packs index ======
async function loadPacksIndex(){
  if(state.packsIndex) return state.packsIndex;
  const res = await fetch("./packs/index.json");
  if(!res.ok) throw new Error("讀取 packs/index.json 失敗");
  state.packsIndex = await res.json();
  return state.packsIndex;
}
async function loadPackFile(file){
  const res = await fetch(`./packs/${file}`);
  if(!res.ok) throw new Error(`讀取題庫失敗：${file}`);
  return await res.json();
}

// ====== Stage selectors ======
function buildStageOptions(indexJson){
  const packs = indexJson.packs || [];
  const grades = [...new Set(packs.map(p => p.grade))].sort((a,b)=>a-b);
  const terms = [...new Set(packs.map(p => p.term))].sort();
  const phases = ["practice","midterm","final"];

  // Grade
  $("selGrade").innerHTML = grades.map(g => `<option value="${g}">${g} 年級</option>`).join("");
  // Term
  $("selTerm").innerHTML = terms.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  // Phase
  $("selPhase").innerHTML = phases.map(ph => `<option value="${ph}">${ph}（${PHASE_LABEL[ph]}）</option>`).join("");

  // Default if exists
  state.stage.grade = grades[0] ?? 2;
  state.stage.term = terms.includes("2-1") ? "2-1" : (terms[0] ?? "2-1");
  state.stage.phase = "midterm";

  $("selGrade").value = String(state.stage.grade);
  $("selTerm").value = state.stage.term;
  $("selPhase").value = state.stage.phase;

  $("selGrade").addEventListener("change", ()=> state.stage.grade = Number($("selGrade").value));
  $("selTerm").addEventListener("change",  ()=> state.stage.term  = $("selTerm").value);
  $("selPhase").addEventListener("change", ()=> state.stage.phase = $("selPhase").value);
}

// ====== Kid selection ======
function setKid(kidId){
  if(kidId === "xigua") state.kid = { id:"xigua", name:"西瓜", emoji:"🍉" };
  if(kidId === "youzi") state.kid = { id:"youzi", name:"柚子", emoji:"🍊" };
  $("currentKidLabel").textContent = state.kid ? `${state.kid.emoji} ${state.kid.name}` : "未選擇";
}

// ====== Dungeons screen ======
function stageLabel(){
  const g = state.stage.grade ?? "?";
  const t = state.stage.term ?? "?";
  const ph = state.stage.phase ?? "?";
  return `${g}年級 / ${t} / ${PHASE_LABEL[ph] ?? ph}`;
}

function findPackForDungeon(dungeonId){
  const packs = (state.packsIndex?.packs || []).filter(p =>
    Number(p.grade) === Number(state.stage.grade) &&
    p.term === state.stage.term &&
    p.phase === state.stage.phase &&
    p.dungeon === dungeonId
  );
  return packs[0] || null;
}

function renderDungeons(){
  $("crumbKid").textContent = state.kid ? `${state.kid.emoji} ${state.kid.name}` : "未選角色";
  $("crumbStage").textContent = stageLabel();

  const grid = $("dungeonGrid");
  grid.innerHTML = "";

  for(const d of DUNGEONS){
    const pack = findPackForDungeon(d.id);
    const enabled = Boolean(pack) && (d.id === "chinese_forest" || d.id === "math_mine" || true);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div class="h2">${esc(d.icon)} ${esc(d.name)}</div>
        <div class="pill">${pack ? "可進入" : "施工中"}</div>
      </div>
      <div class="small" style="margin-top:8px;">${esc(d.desc)}</div>
      <div class="row" style="margin-top:12px;">
        <button class="btn btn-primary" ${pack ? "" : "disabled"}>進入副本</button>
      </div>
    `;
    const btn = card.querySelector("button");
    btn.addEventListener("click", async ()=>{
      if(!pack) return;
      await startRun(pack);
    });

    grid.appendChild(card);
  }
}

// ====== Run (session) ======
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function pickN(questions, n){
  const a = shuffle(questions);
  return a.slice(0, Math.min(n, a.length));
}
function normalize(s){ return String(s ?? "").trim().toLowerCase(); }

function addParts(parts, q, isCorrect){
  // 答錯也給少量，避免挫折；你可改成答錯不給
  const diff = Number(q.difficulty || 1);

  const add = (name, n) => { parts[name] = (parts[name] || 0) + n; };

  if(!isCorrect){
    add("木頭", 1);
    return parts;
  }

  if(diff === 1) add("木頭", 2);
  else if(diff === 2) add("石頭", 2);
  else if(diff === 3) add("鐵釘", 1);
  else if(diff === 4) add("金礦", 1);
  else if(diff === 5) add("鑽石", 1);

  return parts;
}

function calcHouses(parts){
  // 展示用換算：你可以調整
  const w = parts["木頭"] || 0;
  const s = parts["石頭"] || 0;
  const i = parts["鐵釘"] || 0;
  const g = parts["金礦"] || 0;
  const d = parts["鑽石"] || 0;

  return {
    wood: Math.floor(w / 10),
    stone: Math.floor(s / 10),
    iron: Math.floor(i / 5),
    gold: Math.floor(g / 3),
    diamond: Math.floor(d / 2)
  };
}

async function startRun(packIndexEntry){
  state.selectedPack = packIndexEntry;
  state.packData = await loadPackFile(packIndexEntry.file);

  const allQ = state.packData.questions || [];
  const sessionQ = pickN(allQ, 5); // 本場 5 題，可改
  state.session = {
    questions: sessionQ,
    i: 0,
    correct: 0,
    parts: {}
  };

  // UI init
  $("runKid").textContent = state.kid ? `${state.kid.emoji} ${state.kid.name}` : "未選角色";
  $("runPackTitle").textContent = packIndexEntry.title || packIndexEntry.id;
  $("runTotal").textContent = String(sessionQ.length);

  $("questionCard").classList.remove("hidden");
  $("resultCard").classList.add("hidden");

  renderQuestion();
  show("screen-run");
}

function setProgress(){
  const total = state.session.questions.length;
  const idx = state.session.i;
  const pct = Math.floor((idx / total) * 100);
  $("runProgress").style.width = `${pct}%`;
}

function renderQuestion(){
  const s = state.session;
  const total = s.questions.length;
  const q = s.questions[s.i];

  setProgress();

  $("qIndex").textContent = String(s.i + 1);
  $("qDiff").textContent = String(q.difficulty || 1);
  $("qPrompt").textContent = q.prompt || "";

  $("feedback").classList.add("hidden");
  $("nextBtn").classList.add("hidden");

  // areas
  $("mcqArea").classList.add("hidden");
  $("fillArea").classList.add("hidden");
  $("mcqArea").innerHTML = "";
  $("fillInput").value = "";

  if(q.type === "mcq"){
    $("mcqArea").classList.remove("hidden");
    for(const choice of (q.choices || [])){
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost choiceBtn";
      btn.textContent = choice;
      btn.addEventListener("click", ()=> submitAnswer(choice));
      $("mcqArea").appendChild(btn);
    }
  } else {
    $("fillArea").classList.remove("hidden");
  }
}

function lockChoices(){
  // disable MCQ buttons
  document.querySelectorAll(".choiceBtn").forEach(b => b.disabled = true);
  $("fillSubmit").disabled = true;
}

function submitAnswer(answer){
  const s = state.session;
  const q = s.questions[s.i];

  lockChoices();

  let ok = false;
  if(q.type === "mcq"){
    ok = normalize(answer) === normalize(q.answer);
  } else {
    ok = normalize(answer) === normalize(q.answer);
  }

  if(ok) s.correct += 1;
  addParts(s.parts, q, ok);

  // feedback
  const fb = $("feedback");
  fb.classList.remove("hidden","ok","bad");
  fb.classList.add(ok ? "ok" : "bad");

  const explain = q.explain ? `\n\n提示：${q.explain}` : "";
  fb.textContent = ok
    ? `✅ 答對！你拿到零件獎勵！${explain}`
    : `❌ 答錯。正確答案：${q.answer}${explain}`;

  $("nextBtn").classList.remove("hidden");
}

function nextStep(){
  const s = state.session;
  s.i += 1;

  if(s.i >= s.questions.length){
    showResult();
    return;
  }

  // re-enable submit
  $("fillSubmit").disabled = false;

  renderQuestion();
}

function showResult(){
  $("questionCard").classList.add("hidden");
  $("resultCard").classList.remove("hidden");
  $("runProgress").style.width = "100%";

  const s = state.session;
  $("resCorrect").textContent = String(s.correct);
  $("resTotal").textContent = String(s.questions.length);

  const dname = DUNGEONS.find(d => d.id === state.selectedPack.dungeon)?.name || state.selectedPack.dungeon;
  $("resDungeon").textContent = dname;

  // parts
  const parts = s.parts;
  const partsEl = $("resParts");
  partsEl.innerHTML = "";
  const keys = Object.keys(parts);
  if(keys.length === 0){
    partsEl.innerHTML = `<div class="small">（本場沒有獲得零件）</div>`;
  } else {
    keys.sort().forEach(k=>{
      const div = document.createElement("div");
      div.className = "part";
      div.textContent = `${k} x ${parts[k]}`;
      partsEl.appendChild(div);
    });
  }

  // houses display
  const houses = calcHouses(parts);
  const lines = [];
  if(houses.wood) lines.push(`木屋🏠 x ${houses.wood}`);
  if(houses.stone) lines.push(`石屋🏚️ x ${houses.stone}`);
  if(houses.iron) lines.push(`鐵屋🏰 x ${houses.iron}`);
  if(houses.gold) lines.push(`金屋✨ x ${houses.gold}`);
  if(houses.diamond) lines.push(`鑽石城堡💎 x ${houses.diamond}`);
  $("resHouses").textContent = lines.length ? lines.join("  |  ") : "（零件不足以蓋房子，再挑戰一次！）";
}

// ====== Admin: PDF -> text -> draft JSON ======
function ensurePdfJs(){
  if(!window.pdfjsLib) throw new Error("pdf.js 載入失敗（可能被網路阻擋）");
  // worker
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js";
}

async function extractTextFromPdf(file){
  ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let all = "";
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(it => it.str);
    all += strings.join(" ") + "\n";
  }
  return all;
}

// 簡單 parser：抓題號 + 選項 A/B/C/D
function parseTextToQuestions(raw){
  const text = raw.replace(/\r/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // 把所有行合併成一個大字串，方便用 regex 拆題
  const blob = lines.join("\n");

  // pattern: 1. 題幹 ... A. ... B. ... C. ... D. ...
  // 支援：1、1.、1) 以及 A. / A) / (A)
  const qBlocks = blob.split(/\n(?=\d+[\.\)、\)]\s*)/g).map(s=>s.trim()).filter(Boolean);

  const questions = [];
  let qn = 0;

  for(const block of qBlocks){
    // 先拿題號
    const mNo = block.match(/^(\d+)[\.\)、\)]\s*/);
    const body = mNo ? block.replace(mNo[0], "") : block;

    // 找選項
    // 把 A/B/C/D 拆出來
    const optRegex = /(?:^|\n)\s*(?:\(?([ABCD])\)?)[\.\)、\)]\s*([^\n]+)/g;
    const opts = [];
    let mm;
    while((mm = optRegex.exec(body))){
      opts.push({ key:mm[1], text:mm[2].trim() });
    }

    // 題幹 = body 去掉所有選項行
    let prompt = body;
    if(opts.length){
      prompt = body.replace(optRegex, "").trim();
    }

    qn += 1;

    if(opts.length >= 2){
      questions.push({
        id: `q-${String(qn).padStart(3,"0")}`,
        type: "mcq",
        difficulty: 2,
        prompt,
        choices: opts.map(o=>o.text),
        answer: opts[0].text // 先用 A 當預設答案（你可在草稿 JSON 改正）
      });
    } else if(prompt){
      questions.push({
        id: `q-${String(qn).padStart(3,"0")}`,
        type: "fill",
        difficulty: 2,
        prompt,
        answer: "" // 需要你手動補答案
      });
    }
  }

  return questions;
}

function buildPackFromDraft(){
  const id = $("metaId").value.trim();
  const title = $("metaTitle").value.trim();
  const grade = Number($("metaGrade").value.trim() || "2");
  const term = $("metaTerm").value;
  const phase = $("metaPhase").value;
  const dungeon = $("metaDungeon").value;

  let draft;
  try{
    draft = JSON.parse($("draftJson").value || "{}");
  }catch{
    alert("草稿 JSON 不是合法 JSON，請先修正");
    return null;
  }

  // 若 draft 是 questions 陣列，包成 pack；若已是 pack 格式，就補 meta
  if(Array.isArray(draft)){
    return {
      meta: { id, title, grade, term, phase, dungeon },
      questions: draft
    };
  }

  if(draft && typeof draft === "object"){
    draft.meta = draft.meta || {};
    draft.meta.id = id || draft.meta.id;
    draft.meta.title = title || draft.meta.title;
    draft.meta.grade = Number(draft.meta.grade || grade);
    draft.meta.term = draft.meta.term || term;
    draft.meta.phase = draft.meta.phase || phase;
    draft.meta.dungeon = draft.meta.dungeon || dungeon;
    draft.questions = draft.questions || [];
    return draft;
  }

  alert("草稿內容不正確");
  return null;
}

function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function genIndexEntry(){
  const id = $("metaId").value.trim();
  const title = $("metaTitle").value.trim();
  const grade = Number($("metaGrade").value.trim() || "2");
  const term = $("metaTerm").value;
  const phase = $("metaPhase").value;
  const dungeon = $("metaDungeon").value;

  const file = `${id}.json`; // 建議檔名 = id.json
  const entry = {
    id, grade, term, phase, dungeon, title, file
  };
  $("indexEntry").textContent = JSON.stringify(entry, null, 2);
}

// ====== Event wiring ======
async function boot(){
  // nav
  $("navHome").addEventListener("click", ()=> show("screen-home"));
  $("navAdmin").addEventListener("click", ()=> show("screen-admin"));

  $("pickXigua").addEventListener("click", ()=> setKid("xigua"));
  $("pickYouzi").addEventListener("click", ()=> setKid("youzi"));

  $("goDungeons").addEventListener("click", ()=>{
    if(!state.kid){
      alert("請先選角色（西瓜/柚子）");
      return;
    }
    renderDungeons();
    show("screen-dungeons");
  });

  $("backHome").addEventListener("click", ()=> show("screen-home"));
  $("backFromAdmin").addEventListener("click", ()=> show("screen-home"));

  // run
  $("nextBtn").addEventListener("click", nextStep);
  $("fillSubmit").addEventListener("click", ()=> submitAnswer($("fillInput").value));
  $("fillInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") submitAnswer($("fillInput").value); });

  $("playAgain").addEventListener("click", async ()=>{
    if(!state.selectedPack) return;
    await startRun(state.selectedPack);
  });
  $("backDungeons").addEventListener("click", ()=>{
    renderDungeons();
    show("screen-dungeons");
  });

  // admin
  $("parsePdfBtn").addEventListener("click", async ()=>{
    const f = $("pdfFile").files?.[0];
    if(!f){ alert("請先選擇 PDF 檔"); return; }
    try{
      const text = await extractTextFromPdf(f);
      $("rawText").value = text;
      alert("PDF 文字解析完成！你可以直接『轉成題目草稿』");
    }catch(err){
      alert("PDF 解析失敗：\n" + (err?.message || err));
    }
  });
  $("clearTextBtn").addEventListener("click", ()=>{
    $("rawText").value = "";
  });
  $("toDraftBtn").addEventListener("click", ()=>{
    const raw = $("rawText").value.trim();
    if(!raw){ alert("請先貼上文字或解析 PDF"); return; }
    const qs = parseTextToQuestions(raw);
    const pack = {
      meta: {
        id: $("metaId").value.trim(),
        title: $("metaTitle").value.trim(),
        grade: Number($("metaGrade").value.trim() || "2"),
        term: $("metaTerm").value,
        phase: $("metaPhase").value,
        dungeon: $("metaDungeon").value
      },
      questions: qs
    };
    $("draftJson").value = JSON.stringify(pack, null, 2);
    alert(`完成：已產生 ${qs.length} 題草稿（請檢查答案/難度）。`);
  });

  $("downloadPackBtn").addEventListener("click", ()=>{
    const id = $("metaId").value.trim();
    if(!id){ alert("請先填 Pack id"); return; }
    const pack = buildPackFromDraft();
    if(!pack) return;
    downloadJson(`${id}.json`, pack);
  });

  $("genIndexEntryBtn").addEventListener("click", genIndexEntry);

  // preload packs index and stage options
  const idx = await loadPacksIndex();
  buildStageOptions(idx);

  // defaults
  setKid(null);
  $("metaGrade").value = "2";
  $("metaId").value = "g2-1-mid-chinese";
  $("metaTitle").value = "二年級上｜期中｜文字魔法森林";
  genIndexEntry();

  show("screen-home");
}

boot().catch(err=>{
  alert("啟動失敗：" + (err?.message || err));
});

