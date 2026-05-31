import { useState, useEffect, useRef } from "react";

const CATEGORIES = ["和食", "洋食", "中華", "イタリアン", "スープ", "お菓子", "その他"];
const CATEGORY_COLORS = {
  "和食": "#c84b31",
  "洋食": "#2d6a4f",
  "中華": "#e9c46a",
  "イタリアン": "#e76f51",
  "スープ": "#457b9d",
  "お菓子": "#b5838d",
  "その他": "#6d6875",
};

const SAMPLE_RECIPES = [
  {
    id: 1,
    title: "簡単！鶏むね肉のやわらか唐揚げ",
    url: "https://www.youtube.com/watch?v=sample1",
    source: "YouTube",
    category: "和食",
    tags: ["揚げ物", "鶏肉", "お弁当"],
    thumbnail: null,
    memo: "片栗粉を多めにするとサクサクになる",
    cookedDates: ["2024-11-10", "2025-01-22"],
    addedAt: "2024-11-05",
    ingredients: ["鶏むね肉 300g", "醤油 大2", "みりん 大1", "片栗粉 適量"],
    steps: ["鶏肉を一口大に切る", "醤油・みりんで下味をつける", "片栗粉をまぶして揚げる"],
  },
  {
    id: 2,
    title: "本格カルボナーラ",
    url: "https://x.com/sample/status/2",
    source: "X",
    category: "イタリアン",
    tags: ["パスタ", "卵", "チーズ"],
    thumbnail: null,
    memo: "火を止めてから混ぜるのがポイント",
    cookedDates: ["2025-02-14"],
    addedAt: "2025-01-18",
    ingredients: ["パスタ 200g", "卵黄 3個", "パンチェッタ 80g", "パルメザン 50g"],
    steps: ["パスタを茹でる", "パンチェッタを炒める", "火を止めて卵黄とチーズを混ぜる"],
  },
];

function detectSource(url) {
  if (url.includes("youtube") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("x.com") || url.includes("twitter.com")) return "X";
  if (url.includes("instagram")) return "Instagram";
  if (url.includes("tiktok")) return "TikTok";
  return "Web";
}

function getSourceIcon(source) {
  const icons = {
    YouTube: "▶",
    X: "𝕏",
    Instagram: "◈",
    TikTok: "♪",
    Web: "🌐",
  };
  return icons[source] || "🌐";
}

async function extractRecipeWithAI(url) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `以下のURLからレシピ情報を推測・生成してください。URLのドメインや構造からどんなレシピか想像して、それらしいレシピ情報をJSON形式で返してください。

URL: ${url}

以下のJSON形式のみで返してください（説明文なし、Markdownなし）：
{
  "title": "レシピ名",
  "category": "${CATEGORIES.join('" or "')}のいずれか",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "ingredients": ["材料1", "材料2"],
  "steps": ["手順1", "手順2"],
  "memo": "ポイントやコツ"
}`,
        },
      ],
    }),
  });
  const data = await response.json();
  const text = data.content.map((i) => i.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export default function RecipeManager() {
  const [recipes, setRecipes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("list"); // list | detail | add
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTag, setFilterTag] = useState("");
  const [addStep, setAddStep] = useState("import"); // url | form | loading | done
  const [urlInput, setUrlInput] = useState("");
  const [draft, setDraft] = useState(null);
  const [addCookedDate, setAddCookedDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const inputRef = useRef();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("recipe-box"));
      setRecipes(saved && saved.length > 0 ? saved : SAMPLE_RECIPES);
    } catch {
      setRecipes(SAMPLE_RECIPES);
    }
    setLoaded(true);
  }, []);

  // Save to localStorage whenever recipes change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("recipe-box", JSON.stringify(recipes));
    } catch (e) {
      console.error("保存エラー:", e);
    }
  }, [recipes, loaded]);

  useEffect(() => {
    if (view === "add" && addStep === "url" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [view, addStep]);

  const allTags = [...new Set(recipes.flatMap((r) => r.tags))];

  const filtered = recipes.filter((r) => {
    const matchSearch =
      !search ||
      r.title.includes(search) ||
      r.tags.some((t) => t.includes(search)) ||
      (r.memo && r.memo.includes(search));
    const matchCat = filterCategory === "all" || r.category === filterCategory;
    const matchTag = !filterTag || r.tags.includes(filterTag);
    return matchSearch && matchCat && matchTag;
  });

  async function handleExtract() {
    if (!urlInput.trim()) return;
    setAddStep("loading");
    setError("");
    try {
      const source = detectSource(urlInput);
      const info = await extractRecipeWithAI(urlInput);
      setDraft({
        id: Date.now(),
        url: urlInput,
        source,
        title: info.title || "無題のレシピ",
        category: CATEGORIES.includes(info.category) ? info.category : "その他",
        tags: info.tags || [],
        ingredients: info.ingredients || [],
        steps: info.steps || [],
        memo: info.memo || "",
        thumbnail: null,
        cookedDates: [],
        addedAt: new Date().toISOString().split("T")[0],
      });
      setAddStep("form");
    } catch (e) {
      setError("情報の抽出に失敗しました。手動で入力してください。");
      setDraft({
        id: Date.now(),
        url: urlInput,
        source: detectSource(urlInput),
        title: "",
        category: "その他",
        tags: [],
        ingredients: [],
        steps: [],
        memo: "",
        thumbnail: null,
        cookedDates: [],
        addedAt: new Date().toISOString().split("T")[0],
      });
      setAddStep("form");
    }
  }

  function handleImport() {
    setImportError("");
    try {
      const raw = importJson.trim().replace(/```json|```/g, "").trim();
      const data = JSON.parse(raw);
      const recipes_to_add = Array.isArray(data) ? data : [data];
      const normalized = recipes_to_add.map((r) => ({
        id: Date.now() + Math.random(),
        url: r.url || "",
        source: r.source || detectSource(r.url || ""),
        title: r.title || "無題のレシピ",
        category: CATEGORIES.includes(r.category) ? r.category : "その他",
        tags: r.tags || [],
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        memo: r.memo || "",
        thumbnail: null,
        cookedDates: [],
        addedAt: new Date().toISOString().split("T")[0],
      }));
      setRecipes((prev) => [...normalized, ...prev]);
      setImportJson("");
      setView("list");
    } catch (e) {
      setImportError("JSONの形式が正しくありません。Claudeから出力されたテキストをそのまま貼り付けてください。");
    }
  }

  function handleSaveDraft() {
    setRecipes((prev) => [draft, ...prev]);
    setView("list");
    setAddStep("import");
    setUrlInput("");
    setDraft(null);
    setError("");
  }

  function handleAddCookedDate(recipe) {
    if (!addCookedDate) return;
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipe.id
          ? { ...r, cookedDates: [...r.cookedDates, addCookedDate].sort() }
          : r
      )
    );
    setSelected((prev) => ({
      ...prev,
      cookedDates: [...prev.cookedDates, addCookedDate].sort(),
    }));
    setAddCookedDate("");
  }

  function handleAddTag() {
    if (!tagInput.trim() || draft.tags.includes(tagInput.trim())) return;
    setDraft((d) => ({ ...d, tags: [...d.tags, tagInput.trim()] }));
    setTagInput("");
  }

  function openDetail(r) {
    setSelected(r);
    setView("detail");
  }

  const catColor = (cat) => CATEGORY_COLORS[cat] || "#888";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', Georgia, serif",
      color: "#1a1208",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #e9c46a55; }
        input, textarea { font-family: inherit; }
        .recipe-card {
          background: #fff;
          border: 1px solid #e8e0d0;
          border-radius: 4px;
          padding: 18px 20px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .recipe-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--accent);
          transform: scaleY(0);
          transition: transform 0.2s;
        }
        .recipe-card:hover { box-shadow: 0 4px 20px #0001; transform: translateY(-1px); }
        .recipe-card:hover::before { transform: scaleY(1); }
        .tag-pill {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 11px;
          background: #f0ece4;
          color: #665544;
          border: 1px solid #ddd8cc;
          cursor: pointer;
          transition: background 0.15s;
        }
        .tag-pill:hover { background: #e9c46a44; }
        .tag-pill.active { background: #e9c46a; color: #1a1208; border-color: #d4a820; }
        .btn {
          padding: 8px 20px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          transition: all 0.15s;
        }
        .btn-primary { background: #1a1208; color: #faf7f2; }
        .btn-primary:hover { background: #2d2010; }
        .btn-outline { background: transparent; border: 1px solid #c8b89a; color: #665544; }
        .btn-outline:hover { background: #f0ece4; }
        .input-field {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #ddd8cc;
          border-radius: 3px;
          background: #fff;
          font-size: 14px;
          outline: none;
          transition: border 0.2s;
        }
        .input-field:focus { border-color: #c8a96e; }
        .cooked-dot { 
          display: inline-block; width: 8px; height: 8px; 
          background: #c84b31; border-radius: 50%; margin-right: 6px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid #e8e0d0;
          border-top-color: #c8a96e;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fadeIn 0.3s ease both; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #e8e0d0",
        background: "#faf7f2",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setView("list")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.04em", color: "#1a1208" }}>𝓡ecipe Box</div>
            <div style={{ fontSize: 10, color: "#998877", letterSpacing: "0.15em", marginTop: 1 }}>MY KITCHEN COLLECTION</div>
          </button>
          {view !== "add" && (
            <button className="btn btn-primary" onClick={() => { setView("add"); setAddStep("url"); setUrlInput(""); setDraft(null); setError(""); }}>
              ＋ レシピを追加
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}>

        {/* LIST VIEW */}
        {view === "list" && !loaded && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="spinner" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 13, color: "#998877" }}>データを読み込み中…</div>
          </div>
        )}
        {view === "list" && loaded && (
          <div className="fade-in">
            {/* Stats */}
            <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
              {[
                { label: "レシピ数", value: recipes.length },
                { label: "調理回数", value: recipes.reduce((s, r) => s + r.cookedDates.length, 0) },
                { label: "カテゴリ", value: [...new Set(recipes.map((r) => r.category))].length },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: "#fff", border: "1px solid #e8e0d0", borderRadius: 4, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#998877", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <input
              className="input-field"
              placeholder="レシピ名・タグで検索…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {/* Category filter */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {["all", ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: filterCategory === c ? `1.5px solid ${c === "all" ? "#1a1208" : catColor(c)}` : "1px solid #ddd8cc",
                    background: filterCategory === c ? (c === "all" ? "#1a1208" : catColor(c) + "22") : "#fff",
                    color: filterCategory === c ? (c === "all" ? "#fff" : catColor(c)) : "#665544",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {c === "all" ? "すべて" : c}
                </button>
              ))}
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {allTags.map((t) => (
                  <span
                    key={t}
                    className={`tag-pill ${filterTag === t ? "active" : ""}`}
                    onClick={() => setFilterTag(filterTag === t ? "" : t)}
                  >#{t}</span>
                ))}
              </div>
            )}

            {/* Recipe list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#998877", fontSize: 14 }}>
                  レシピが見つかりません
                </div>
              ) : filtered.map((r) => (
                <div
                  key={r.id}
                  className="recipe-card"
                  style={{ "--accent": catColor(r.category) }}
                  onClick={() => openDetail(r)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 2,
                          background: catColor(r.category) + "22",
                          color: catColor(r.category),
                          border: `1px solid ${catColor(r.category)}44`,
                        }}>{r.category}</span>
                        <span style={{ fontSize: 11, color: "#998877" }}>{getSourceIcon(r.source)} {r.source}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>{r.title}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {r.tags.map((t) => (
                          <span key={t} className="tag-pill">#{t}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: r.cookedDates.length > 0 ? "#c84b31" : "#ccc" }}>
                        {r.cookedDates.length}
                      </div>
                      <div style={{ fontSize: 10, color: "#998877" }}>回調理</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === "detail" && selected && (
          <div className="fade-in">
            <button className="btn btn-outline" style={{ marginBottom: 20 }} onClick={() => setView("list")}>
              ← 一覧に戻る
            </button>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 2,
                background: catColor(selected.category) + "22",
                color: catColor(selected.category),
                border: `1px solid ${catColor(selected.category)}44`,
              }}>{selected.category}</span>
              <span style={{ fontSize: 12, color: "#998877" }}>{getSourceIcon(selected.source)} {selected.source}</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, lineHeight: 1.4, color: "#1a1208" }}>{selected.title}</h1>

            <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#c8a96e", wordBreak: "break-all" }}>
              {selected.url}
            </a>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
              {selected.tags.map((t) => (
                <span key={t} className="tag-pill">#{t}</span>
              ))}
            </div>

            {selected.memo && (
              <div style={{ background: "#fff8e8", border: "1px solid #e9c46a55", borderRadius: 4, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#665544" }}>
                📝 {selected.memo}
              </div>
            )}

            {selected.ingredients.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#998877", marginBottom: 8 }}>材料</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {selected.ingredients.map((ing, i) => (
                    <div key={i} style={{ fontSize: 13, padding: "6px 10px", background: "#fff", border: "1px solid #e8e0d0", borderRadius: 3 }}>{ing}</div>
                  ))}
                </div>
              </div>
            )}

            {selected.steps.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#998877", marginBottom: 8 }}>作り方</div>
                {selected.steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#1a1208", color: "#faf7f2", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.6, paddingTop: 3 }}>{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cooking history */}
            <div style={{ background: "#fff", border: "1px solid #e8e0d0", borderRadius: 4, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#998877", marginBottom: 12 }}>調理記録</div>
              {selected.cookedDates.length === 0 ? (
                <div style={{ fontSize: 13, color: "#ccc", marginBottom: 12 }}>まだ調理していません</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {selected.cookedDates.map((d, i) => (
                    <span key={i} style={{ fontSize: 12, padding: "4px 10px", background: "#fff0ee", border: "1px solid #f4c1b8", borderRadius: 20, color: "#c84b31" }}>
                      <span className="cooked-dot" />{d}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  className="input-field"
                  style={{ flex: 1 }}
                  value={addCookedDate}
                  onChange={(e) => setAddCookedDate(e.target.value)}
                />
                <button className="btn btn-primary" onClick={() => handleAddCookedDate(selected)}>
                  記録する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD VIEW */}
        {view === "add" && (
          <div className="fade-in">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>レシピを追加</div>
            </div>

            {/* TAB */}
            <div style={{ display: "flex", borderBottom: "1px solid #e8e0d0", marginBottom: 20 }}>
              {["import", "manual"].map((t) => (
                <button key={t} onClick={() => setAddStep(t)} style={{
                  flex: 1, padding: "10px", border: "none", background: "none",
                  fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                  borderBottom: addStep === t ? "2px solid #1a1208" : "2px solid transparent",
                  color: addStep === t ? "#1a1208" : "#998877",
                  fontWeight: addStep === t ? 600 : 400,
                }}>
                  {t === "import" ? "📋 Claudeからインポート" : "✏️ 手動入力"}
                </button>
              ))}
            </div>

            {addStep === "import" && (
              <div>
                <div style={{ background: "#fff8e8", border: "1px solid #e9c46a55", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#665544", lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>使い方</div>
                  <div>① このチャット（Claude）にレシピのURLを貼る</div>
                  <div>② ClaudeがJSONを生成する</div>
                  <div>③ そのテキストをここに貼り付けて「インポート」</div>
                </div>
                {importError && (
                  <div style={{ background: "#fff0ee", border: "1px solid #f4c1b8", borderRadius: 4, padding: "10px 14px", fontSize: 12, color: "#c84b31", marginBottom: 12 }}>
                    {importError}
                  </div>
                )}
                <textarea
                  className="input-field"
                  rows={8}
                  placeholder={"ClaudeのJSONをここに貼り付け…"}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  style={{ marginBottom: 12, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleImport}>インポート</button>
                  <button className="btn btn-outline" onClick={() => setView("list")}>キャンセル</button>
                </div>
              </div>
            )}

            {addStep === "loading" && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div className="spinner" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 13, color: "#998877" }}>処理中…</div>
              </div>
            )}

            {addStep === "form" && draft && (
              <div>
                {error && (
                  <div style={{ background: "#fff0ee", border: "1px solid #f4c1b8", borderRadius: 4, padding: "10px 14px", fontSize: 12, color: "#c84b31", marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <div style={{ background: "#fff", border: "1px solid #e8e0d0", borderRadius: 4, padding: "20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#998877", marginBottom: 12 }}>基本情報</div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "#998877", display: "block", marginBottom: 4 }}>レシピ名</label>
                    <input className="input-field" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "#998877", display: "block", marginBottom: 4 }}>カテゴリ</label>
                    <select
                      className="input-field"
                      value={draft.category}
                      onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "#998877", display: "block", marginBottom: 4 }}>メモ</label>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={draft.memo}
                      onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: "#998877", display: "block", marginBottom: 4 }}>タグ</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {draft.tags.map((t, i) => (
                        <span key={i} className="tag-pill active" style={{ cursor: "default" }}>
                          #{t}
                          <span
                            onClick={() => setDraft((d) => ({ ...d, tags: d.tags.filter((_, j) => j !== i) }))}
                            style={{ marginLeft: 4, cursor: "pointer", opacity: 0.6 }}
                          >×</span>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input-field"
                        placeholder="タグを追加"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-outline" onClick={handleAddTag}>追加</button>
                    </div>
                  </div>
                </div>

                {draft.ingredients.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #e8e0d0", borderRadius: 4, padding: "20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#998877", marginBottom: 10 }}>材料（AI抽出）</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {draft.ingredients.map((ing, i) => (
                        <div key={i} style={{ fontSize: 13, padding: "6px 10px", background: "#faf7f2", border: "1px solid #e8e0d0", borderRadius: 3 }}>{ing}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveDraft}>
                    保存する
                  </button>
                  <button className="btn btn-outline" onClick={() => { setView("list"); setAddStep("url"); }}>キャンセル</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
