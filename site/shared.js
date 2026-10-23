/* GCSE Week Planner: shared data and logic.
   Used by the intranet site (browser), the generator (Node) and the review tool.
   School setup: Maths = Pearson Edexcel 1MA1; English Language = AQA 8700; English Literature = AQA 8702;
   Science = AQA 8464 (Combined Science: Trilogy) or 8461 / 8462 / 8463 (separate sciences).
   Topic flags in the lists below: ^ = Higher tier only, * = separate science only.
   Check every list against the current published specifications before relying on it. */
(function (root) {
  "use strict";

  /* ---------------- Specification data ---------------- */
  const MATHS = [
    ["Number","Place value, ordering and negative numbers|Calculating with integers, decimals and fractions|Factors, multiples and primes (HCF and LCM)|Powers, roots and index laws|Standard form|^Surds|Fractions, decimals and percentages|^Recurring decimals to fractions|Rounding, estimation and significant figures|Error intervals|^Upper and lower bound calculations"],
    ["Algebra","Simplifying expressions|Expanding and factorising brackets|Substitution and rearranging formulae|Solving linear equations|Linear inequalities|Straight-line graphs (y = mx + c)|Quadratic graphs and roots|Solving quadratics by factorising|^Quadratic formula and completing the square|Linear simultaneous equations|^Simultaneous equations with a quadratic|Sequences and the nth term|^Composite and inverse functions|^Algebraic fractions|^Graph transformations|Real-life and distance–time graphs|^Gradients and areas under graphs|^Algebraic proof"],
    ["Ratio, proportion and rates of change","Ratio notation and sharing in a ratio|Best buys and proportion|Percentage change and reverse percentages|Compound interest and depreciation|Direct and inverse proportion|Speed, density and pressure|Converting units|^Exponential growth and decay"],
    ["Geometry and measures","Angles in parallel lines and polygons|Properties of 2D shapes|Perimeter and area|Circles, arcs and sectors|Volume and surface area|Pythagoras' theorem|Right-angled trigonometry|Exact trigonometric values|^Sine rule, cosine rule and ½ab sin C|^3D Pythagoras and trigonometry|Transformations|Constructions and loci|Bearings and scale drawings|Congruence and similarity|^Similar areas and volumes|^Circle theorems|Vectors|^Vector proof"],
    ["Probability","Probability scales and sample spaces|Relative frequency|Venn diagrams and set notation|Tree diagrams|^Conditional probability"],
    ["Statistics","Averages and range|Averages from frequency tables|Bar charts, pie charts and pictograms|Scatter graphs and correlation|^Cumulative frequency and box plots|^Histograms|Sampling"]
  ];

  const LANG = [
    ["Paper 1: Explorations in creative reading and writing","Q1: Retrieving information|Q2: Analysing language|Q3: Analysing structure|Q4: Evaluating a statement about the text|Q5: Descriptive writing|Q5: Narrative writing"],
    ["Paper 2: Writers' viewpoints and perspectives","Q1: Identifying true statements|Q2: Summarising differences|Q3: Analysing language in non-fiction|Q4: Comparing writers' perspectives|Q5: Writing to present a viewpoint"],
    ["Technical accuracy","Sentence variety for effect|Punctuation for effect|Paragraphing and discourse markers"]
  ];

  const POEMS = [
    ["Ozymandias","Percy Bysshe Shelley",true],["London","William Blake",true],["Extract from The Prelude","William Wordsworth",true],
    ["My Last Duchess","Robert Browning",true],["The Charge of the Light Brigade","Alfred, Lord Tennyson",true],["Exposure","Wilfred Owen",true],
    ["Storm on the Island","Seamus Heaney",false],["Bayonet Charge","Ted Hughes",false],["Remains","Simon Armitage",false],
    ["Poppies","Jane Weir",false],["War Photographer","Carol Ann Duffy",false],["Tissue","Imtiaz Dharker",false],
    ["The Emigrée","Carol Rumens",false],["Checking Out Me History","John Agard",false],["Kamikaze","Beatrice Garland",false]
  ]; // third value: out of copyright, so it may be quoted and printed

  const LIT_UNITS = [
    {unit:"Romeo and Juliet", pd:true, exam:"AQA 8702 Paper 1 Section A: an extract from the play is printed; the question asks how Shakespeare presents an idea or character in the extract and in the play as a whole. 30 marks plus 4 marks for spelling, punctuation and grammar (AO4).",
     topics:"Love|Conflict and violence|Fate|Family and parental authority|Youth and age|Juliet's character|Romeo's character|Mercutio, Tybalt and masculinity|The Prologue and dramatic structure|Key quotations"},
    {unit:"Jekyll and Hyde", pd:true, exam:"AQA 8702 Paper 1 Section B: an extract from the novella is printed; the question asks how Stevenson presents an idea or character in the extract and in the novella as a whole. 30 marks.",
     topics:"Duality of human nature|Reputation and secrecy|Science and the supernatural|Violence and Mr Hyde|London as a setting|Victorian context|Utterson as narrator|Dr Lanyon|Structure and the final chapters|Key quotations"},
    {unit:"An Inspector Calls", pd:false, exam:"AQA 8702 Paper 2 Section A: a choice of two essay questions with no extract printed, asking how Priestley presents an idea or character. 30 marks plus 4 marks for AO4.",
     topics:"Social responsibility|Class|Age and generations|Gender: Sheila and Mrs Birling|The Inspector as a dramatic device|Mr Birling and capitalism|Eric and Gerald|Eva Smith|Dramatic structure and the ending|Key quotations"}
  ];
  const POETRY_COMPARISONS = [
    "Comparing poems about the power of nature",
    "Comparing poems about the effects of conflict and trauma",
    "Comparing poems about identity",
    "Comparing poems about the abuse of human power",
    "Comparing poems about memory",
    "Comparing poems about the reality of war"
  ];

  const SCI = {
    biology:{code:"8461", units:[
      ["Cell biology","Eukaryotic and prokaryotic cells|Animal and plant cell structures|Microscopy and magnification|*Culturing microorganisms|Mitosis and the cell cycle|Stem cells|Diffusion|Osmosis|Active transport"],
      ["Organisation","Digestive system and enzymes|Food tests|The heart and blood vessels|Blood|Coronary heart disease|Non-communicable diseases and risk factors|Plant tissues and organs|Transpiration and translocation"],
      ["Infection and response","Communicable diseases and pathogens|Viral, bacterial, fungal and protist diseases|Human defence systems|Vaccination|Antibiotics and painkillers|Discovery and development of drugs|*Monoclonal antibodies|*Plant disease"],
      ["Bioenergetics","Photosynthesis|Rate of photosynthesis and limiting factors|Uses of glucose|Aerobic and anaerobic respiration|Response to exercise|Metabolism"],
      ["Homeostasis and response","Principles of homeostasis|The nervous system and reflex arc|*The brain|*The eye|Hormones and the endocrine system|Control of blood glucose and diabetes|Hormones in human reproduction|Contraception|^Hormones to treat infertility|^Negative feedback: adrenaline and thyroxine|*The kidney and water balance|*Plant hormones"],
      ["Inheritance, variation and evolution","Sexual and asexual reproduction|Meiosis|DNA and the genome|Genetic inheritance and Punnett squares|Inherited disorders|Sex determination|Variation and evolution|Selective breeding|Genetic engineering|Evidence for evolution|Classification of living organisms"],
      ["Ecology","Communities and interdependence|Abiotic and biotic factors|Adaptations|Sampling with quadrats and transects|Carbon and water cycles|Biodiversity and human impact|*Trophic levels and biomass|*Food security"]]},
    chemistry:{code:"8462", units:[
      ["Atomic structure and the periodic table","Atoms, elements and compounds|Mixtures and separation techniques|Development of the atomic model|Subatomic particles and isotopes|Electronic structure|The periodic table|Groups 0, 1 and 7|*Transition metals"],
      ["Bonding, structure and properties","Ionic bonding|Covalent bonding|Metallic bonding|States of matter|Properties of ionic and covalent substances|Diamond, graphite and graphene|Fullerenes|*Nanoparticles"],
      ["Quantitative chemistry","Conservation of mass and balanced equations|Relative formula mass|^Moles|^Using moles to balance equations|Concentration of solutions|*Percentage yield and atom economy|*^Titration calculations"],
      ["Chemical changes","Reactivity series|Extraction of metals|^Oxidation and reduction in terms of electrons|Reactions of acids|Making salts|pH and neutralisation|^Strong and weak acids|Electrolysis of molten compounds|Electrolysis of aqueous solutions"],
      ["Energy changes","Exothermic and endothermic reactions|Reaction profiles|^Bond energy calculations|*Cells and batteries|*Fuel cells"],
      ["Rate and extent of chemical change","Calculating rates of reaction|Factors affecting rate|Collision theory and catalysts|Reversible reactions|^Equilibrium and Le Chatelier's principle"],
      ["Organic chemistry","Crude oil and alkanes|Fractional distillation|Cracking|*Alkenes|*Alcohols|*Carboxylic acids|*Polymers|*Amino acids and DNA"],
      ["Chemical analysis","Pure substances and formulations|Chromatography|Tests for gases|*Flame tests|*Tests for ions|*Instrumental methods"],
      ["Chemistry of the atmosphere","Evolution of the atmosphere|Greenhouse gases and climate change|Atmospheric pollutants"],
      ["Using resources","Finite and renewable resources|Potable water|Waste water treatment|^Alternative methods of extracting metals|Life cycle assessment and recycling|*Corrosion and alloys|*Ceramics, polymers and composites|*The Haber process and NPK fertilisers"]]},
    physics:{code:"8463", units:[
      ["Energy","Energy stores and systems|Kinetic, elastic and gravitational potential energy|Specific heat capacity|Power|Conservation and dissipation of energy|Efficiency|Energy resources"],
      ["Electricity","Circuit symbols and current|Potential difference and resistance|I–V characteristics|Series and parallel circuits|Mains electricity|Power and energy transfers|The National Grid|*Static electricity"],
      ["Particle model of matter","Density|Changes of state and internal energy|Specific latent heat|Particle motion in gases|*Pressure in gases"],
      ["Atomic structure","Structure of the atom|Development of the atomic model|Radioactive decay and nuclear radiation|Nuclear equations|Half-lives|Contamination and irradiation|*Uses of nuclear radiation|*Nuclear fission and fusion"],
      ["Forces","Scalars and vectors|Contact and non-contact forces|Weight and mass|Resultant forces|Work done|Forces and elasticity|*Moments, levers and gears|*Pressure in fluids|Speed and velocity|Acceleration and motion graphs|Newton's laws|Stopping distances|^Momentum|*Changes in momentum"],
      ["Waves","Transverse and longitudinal waves|Properties of waves|*Reflection and sound waves|The electromagnetic spectrum|^Refraction and wavefronts|Uses and dangers of EM waves|*Lenses|*Black body radiation"],
      ["Magnetism and electromagnetism","Poles and magnetic fields|Electromagnetism|^The motor effect|*Electric motors|*Generators and transformers|*Loudspeakers and microphones"],
      ["Space physics","*Our solar system|*Life cycle of a star|*Orbital motion|*Red-shift"]]}
  };

  const SUBJECTS = [
    {key:"maths",     name:"Maths",              board:"Pearson Edexcel", boardKey:"edexcel", code:"1MA1", tiered:true, short:"ma"},
    {key:"englang",   name:"English Language",   board:"AQA", boardKey:"aqa", code:"8700", short:"el"},
    {key:"englit",    name:"English Literature", board:"AQA", boardKey:"aqa", code:"8702", short:"lit"},
    {key:"combined",  name:"Combined Science",   board:"AQA", boardKey:"aqa", code:"8464", tiered:true, short:"cs"},
    {key:"biology",   name:"Biology",            board:"AQA", boardKey:"aqa", code:"8461", tiered:true, short:"bi", sci:true},
    {key:"chemistry", name:"Chemistry",          board:"AQA", boardKey:"aqa", code:"8462", tiered:true, short:"ch", sci:true},
    {key:"physics",   name:"Physics",            board:"AQA", boardKey:"aqa", code:"8463", tiered:true, short:"ph", sci:true}
  ];
  const SUBJ = Object.fromEntries(SUBJECTS.map(s => [s.key, s]));
  const FORMATS = ["Review","Quiz","Exam practice"];
  const FORMAT_INFO = {
    "Review":"Read a summary or watch a video, then write down everything you remember.",
    "Quiz":"20 core questions with answers. Self-quiz in sets of 5 and repeat any you get wrong.",
    "Exam practice":"Exam-style questions sized for 30 minutes, with the mark scheme on the reverse."
  };

  /* ---------------- Topic pools ---------------- */
  function parse(units, opts, extra) {
    const out = [];
    for (const [unit, list] of units) {
      for (let raw of list.split("|")) {
        let higher = false, triple = false;
        while (raw[0] === "^" || raw[0] === "*") { if (raw[0] === "^") higher = true; else triple = true; raw = raw.slice(1); }
        if (higher && opts.tier === "foundation") continue;
        if (triple && !opts.triple) continue;
        out.push(Object.assign({ unit, baseUnit: unit, topic: raw, higher, triple }, extra || {}));
      }
    }
    return out;
  }
  // Topics a student can be given for one planner subject at one tier.
  function pool(subject, tier) {
    if (subject === "maths") return parse(MATHS, { tier, triple: true });
    if (subject === "englang") return parse(LANG, { triple: true });
    if (subject === "englit") {
      const out = [];
      for (const u of LIT_UNITS) for (const t of u.topics.split("|")) out.push({ unit: u.unit, baseUnit: u.unit, topic: t });
      for (const [title] of POEMS) out.push({ unit: "Power and Conflict poetry", baseUnit: "Power and Conflict poetry", topic: title });
      for (const t of POETRY_COMPARISONS) out.push({ unit: "Power and Conflict poetry", baseUnit: "Power and Conflict poetry", topic: t });
      for (const t of ["Analysing an unseen poem","Comparing two unseen poems"]) out.push({ unit: "Unseen poetry", baseUnit: "Unseen poetry", topic: t });
      return out;
    }
    if (subject === "combined") {
      return ["biology","chemistry","physics"].flatMap(s =>
        parse(SCI[s].units, { tier, triple: false }, { sci: s }).map(t => Object.assign(t, { unit: SUBJ[s].name + ": " + t.baseUnit })));
    }
    return parse(SCI[subject].units, { tier, triple: true }, { sci: subject });
  }

  /* ---------------- Worksheet identity ----------------
     Review and Quiz worksheets on a science topic are shared between Combined and separate science
     (same specification content); Exam practice is not, because the papers differ. */
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); }
  function slug(s, n) { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, n).replace(/-$/, ""); }

  function worksheetSpec(subject, tier, t, format) {
    const s = SUBJ[subject];
    const tierUsed = s.tiered ? tier : "";
    let owner = subject, route = null;
    if (t.sci) {
      route = subject === "combined" ? "combined" : "separate";
      if (format !== "Exam practice") { owner = "sci-" + t.sci; route = t.triple ? "separate" : "shared"; }
    }
    const key = [owner, tierUsed, t.baseUnit, t.topic, format].join("|");
    const ownerShort = owner.startsWith("sci-") ? "sc" + SUBJ[t.sci].short : s.short;
    const id = [ownerShort, tierUsed ? tierUsed[0] : "x", slug(t.topic, 28), format[0].toLowerCase(), fnv(key)].join("-");
    let specLabel, subjectLabel;
    if (route === "shared") { subjectLabel = SUBJ[t.sci].name; specLabel = "AQA 8464 / " + SUBJ[t.sci].code; }
    else if (route === "separate" && owner.startsWith("sci-")) { subjectLabel = SUBJ[t.sci].name; specLabel = "AQA " + SUBJ[t.sci].code; }
    else { subjectLabel = s.name; specLabel = s.board + " " + s.code; }
    return { id, key, subject: owner.startsWith("sci-") ? t.sci : subject, planSubject: subject, route, sci: t.sci || null,
      board: s.boardKey, boardName: s.board, specLabel, subjectLabel, tier: tierUsed, unit: t.baseUnit, displayUnit: t.unit,
      topic: t.topic, format, higher: !!t.higher, triple: !!t.triple };
  }
  // Every worksheet the school needs, deduplicated.
  function allWorksheets() {
    const seen = new Map();
    for (const s of SUBJECTS) for (const tier of (s.tiered ? ["higher","foundation"] : [""])) for (const t of pool(s.key, tier)) for (const f of FORMATS) {
      const w = worksheetSpec(s.key, tier, t, f);
      if (!seen.has(w.id)) seen.set(w.id, w);
    }
    return [...seen.values()];
  }

  /* ---------------- Prompts ---------------- */
  const CONVENTIONS = {
    aqa: "AQA style: number questions like 01.1, 01.2, 02.1; show marks as [2 marks]. Mark schemes follow AQA's 'Answers / Extra information / Mark' layout with 'allow' and 'ignore' notes; extended responses (6-mark science questions, English and Literature tasks) use levels of response with indicative content.",
    edexcel: "Pearson Edexcel style: number questions 1, 2, 3 with parts (a), (b); show marks as (2) at the end of each part. Mark schemes use M1 (method), A1 (accuracy), B1 (independent) and P1 (process) marks, with 'oe', 'cao' and 'ft' notes."
  };
  function timing(w) {
    if (w.subject === "maths") return w.tier === "foundation"
      ? "Edexcel 1MA1 papers allow about 1.1 minutes per mark (80 marks in 90 minutes), so set 25 to 27 marks of Foundation-tier questions that rise in difficulty, starting with 1 and 2 mark questions."
      : "Edexcel 1MA1 papers allow about 1.1 minutes per mark (80 marks in 90 minutes), so set 25 to 27 marks of Higher-tier questions that rise in difficulty, including at least one multi-step problem.";
    if (w.planSubject === "combined") return "AQA Trilogy papers allow about 1.1 minutes per mark (70 marks in 75 minutes), so set 24 to 26 marks mixing recall, application, a calculation or data question where relevant, and one 4 to 6 mark extended response.";
    if (w.sci) return "AQA separate science papers allow about 1.05 minutes per mark (100 marks in 105 minutes), so set 26 to 28 marks mixing recall, application, a calculation or data question where relevant, and one 4 to 6 mark extended response.";
    if (w.subject === "englang") return "AQA 8700 papers are 80 marks in 1 hour 45 minutes. Set the real question for this skill in the paper's real format. A Q2 or Q3 analysis task (8 marks) is about 10 to 12 minutes, so for these topics set two such tasks on two different original extracts; a Q4 evaluation (20 marks) fits 25 minutes with reading time; a Q5 writing task (40 marks) is 45 minutes in the exam, so tell the student to plan for 5 minutes and write for 25.";
    if (w.unit === "Unseen poetry") return "AQA 8702 Paper 2 Section C: question 27.1 asks how the poet presents a theme in one unseen poem (24 marks); 27.2 compares it with a second unseen poem (8 marks). Write original poems for this worksheet and fit the tasks into 30 minutes.";
    if (w.unit === "Power and Conflict poetry") return "AQA 8702 Paper 2 Section B: one poem from the cluster is named (and printed in the exam) and the student compares it with one other poem of their choice from the cluster. 30 marks, about 45 minutes in the exam, so tell the student to plan the full comparison in 8 minutes and then write an introduction and two comparative paragraphs.";
    const u = LIT_UNITS.find(x => x.unit === w.unit);
    return (u ? u.exam : "") + " A full answer takes about 50 minutes, so tell the student to plan the whole answer in 8 minutes and then write the introduction and two full analytical paragraphs. Show the real marks for the question.";
  }
  function copyrightRule(w) {
    if (w.subject !== "englit") return "";
    if (w.unit === "Unseen poetry") return "Write any unseen poems yourself and label them as written for this worksheet.";
    if (w.unit === "Power and Conflict poetry") {
      const p = POEMS.find(x => x[0] === w.topic);
      if (p && p[2]) return `${p[0]} by ${p[1]} is out of copyright: you may quote it and, for exam practice, print it in full.`;
      if (p) return `${p[0]} by ${p[1]} is still in copyright: do not reproduce it. Quote no more than a few words at a time and tell the student to use their anthology.`;
      return "Several poems in the cluster are still in copyright: do not reproduce any of them. Quote no more than a few words at a time and tell the student to use their anthology.";
    }
    const u = LIT_UNITS.find(x => x.unit === w.unit);
    if (u && u.pd) return `${u.unit} is out of copyright: you may quote it and print a real extract of about 20 to 30 lines for exam practice.`;
    return `${w.unit} is still in copyright: do not reproduce passages from it. Quote no more than a few words at a time.`;
  }
  function contextLine(w) {
    let spec;
    if (w.route === "shared") spec = `AQA GCSE science. This topic is in both Combined Science: Trilogy (8464) and GCSE ${w.subjectLabel} (${SUBJ[w.sci].code}). Cover what both require; if the separate science specification needs extra depth, add it at the end, labelled "${w.subjectLabel} only".`;
    else if (w.route === "separate") spec = `AQA GCSE ${w.subjectLabel} (${SUBJ[w.subject].code}).`;
    else if (w.route === "combined") spec = "AQA GCSE Combined Science: Trilogy (8464).";
    else spec = `${w.boardName} GCSE ${w.subjectLabel} (${SUBJ[w.subject].code}).`;
    let extra = "";
    if (w.unit === "Power and Conflict poetry") {
      const p = POEMS.find(x => x[0] === w.topic);
      extra = p ? `\nPoem: "${p[0]}" by ${p[1]}, from the AQA Power and Conflict cluster.` : `\nThe AQA Power and Conflict cluster contains: ${POEMS.map(x => x[0] + " (" + x[1] + ")").join(", ")}. Choose the most useful poems from this list for the comparison theme.`;
    }
    return `Exam board and specification: ${spec}${w.tier ? "\nTier: " + w.tier + "." : ""}
Specification area: ${w.unit}.
Topic: ${w.topic}.${extra}
Student: UK GCSE student revising independently in a 30-minute block.`;
  }
  function buildPrompt(w) {
    const base = contextLine(w) + "\n" + copyrightRule(w) + "\nUse UK spelling. Write maths with plain-text symbols (x², √, ½, ×, ÷, π, ≤). Do not use LaTeX or Markdown in any string.\n\n";
    if (w.format === "Review") return base +
`Write a REVIEW worksheet. The student reads the summary for about 8 minutes, covers it, writes down everything they can remember for 15 minutes, then checks and adds missing points in a different colour.
Make the summary cover exactly what this specification expects at this tier for this topic, about 350 to 450 words, in short sections with clear headings. Include the key facts, processes, equations or formulae, worked examples, quotations or techniques the specification requires.
Reply with only JSON in this shape:
{"summary":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}],"key_terms":[{"term":"...","definition":"..."}],"common_mistakes":["..."],"video_search":"a short YouTube search phrase for this exact topic"}
Use 3 to 5 summary sections, 4 to 8 key terms and 2 to 4 common mistakes.`;
    if (w.format === "Quiz") return base +
`Write a QUIZ worksheet of exactly 20 core recall questions with answers. The student self-quizzes in four sets of five, covering the answers, and repeats any they get wrong.
Questions must test the facts, definitions, equations, processes, quotations and examples this specification requires for this topic at this tier. Order them from foundational to more demanding. Each answer must be short enough to check at a glance (one line, at most 20 words) and say what an examiner would accept.
Reply with only JSON in this shape:
{"questions":[{"q":"...","a":"..."}]}`;
    return base +
`Write an EXAM PRACTICE worksheet: original exam-style questions on this topic that read exactly like real ${w.specLabel} questions, with a matching mark scheme. Base the question types, command words (state, describe, explain, calculate, evaluate, compare and so on), mark allocations, stimulus material and mark-scheme wording on this board's real papers and mark schemes, but do not copy any real past-paper question.
${CONVENTIONS[w.board]}
${timing(w)}
Questions must be answerable without a diagram. Where data is needed give it as a table; describe any apparatus or shape in words. Where the real exam would print a source text and none is available out of copyright, write an original one and label it as written for this worksheet.
Reply with only JSON in this shape:
{"timing_note":"one sentence telling the student how to use the 30 minutes","total_marks":0,"sources":[{"label":"Source A","title":"...","text":"..."}],"questions":[{"number":"01.1","text":"...","marks":2,"table":{"headers":["..."],"rows":[["..."]]}}],"mark_scheme":[{"number":"01.1","marks":2,"points":["..."],"guidance":"allow / ignore notes, or the level descriptors and indicative content for extended answers"}]}
Leave "sources" as [] and "table" as null when not needed. total_marks must equal the sum of the question marks, and every question needs a mark_scheme entry with the same number.`;
  }
  function validate(format, d) {
    if (!d || typeof d !== "object") return "not an object";
    if (format === "Review") return Array.isArray(d.summary) && d.summary.length ? null : "missing summary";
    if (format === "Quiz") return Array.isArray(d.questions) && d.questions.length >= 15 ? null : "fewer than 15 questions";
    if (!Array.isArray(d.questions) || !d.questions.length) return "no questions";
    if (!Array.isArray(d.mark_scheme) || !d.mark_scheme.length) return "no mark scheme";
    return null;
  }

  /* ---------------- Rendering (returns HTML strings) ---------------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const arr = v => Array.isArray(v) ? v : [];
  const VIDEO_CHANNELS = {
    maths: ["Corbettmaths","1st Class Maths"],
    english: ["Mr Bruff","Mr Salles Teaches English","Stacey Reay"],
    science: ["Freesciencelessons","Cognito"]
  };
  const ytSearch = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  const marksLabel = (w, m) => w.board === "edexcel" ? `(${m})` : `[${m} mark${m == 1 ? "" : "s"}]`;
  function tableHTML(t, cls) {
    if (!t || !arr(t.headers).length) return "";
    return `<div class="scroll"><table class="${cls || "qtable"}"><thead><tr>${arr(t.headers).map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${arr(t.rows).map(r => `<tr>${arr(r).map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function reviewHTML(w, d) {
    const group = w.subject === "maths" ? "maths" : (w.subject === "englang" || w.subject === "englit") ? "english" : "science";
    const q = d.video_search ? String(d.video_search) : w.topic + " GCSE " + w.subjectLabel;
    const vids = [`<a href="${esc(ytSearch(q + " " + w.boardName + " GCSE"))}" target="_blank" rel="noopener"><span>Search YouTube for “${esc(q)}”</span><small>opens YouTube ↗</small></a>`]
      .concat(VIDEO_CHANNELS[group].map(ch => `<a href="${esc(ytSearch(ch + " " + q))}" target="_blank" rel="noopener"><span>${esc(ch)}: ${esc(q)}</span><small>opens YouTube ↗</small></a>`)).join("");
    return `<ol class="steps">
      <li><div><b>Read or watch</b><span>8 min</span></div></li>
      <li><div><b>Cover it and write everything you remember</b><span>15 min</span></div></li>
      <li><div><b>Check and add what you missed in a different colour</b><span>7 min</span></div></li>
    </ol>
    <div class="paper" id="reviewContent">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="read" aria-selected="true">Read the summary</button>
        <button type="button" role="tab" data-tab="watch" aria-selected="false">Watch a video instead</button>
      </div>
      <div data-pane="read" class="stack">
        ${arr(d.summary).map(s => `<section class="stack-s"><h3>${esc(s.heading)}</h3>
          ${arr(s.paragraphs).map(p => `<p>${esc(p)}</p>`).join("")}
          ${arr(s.bullets).length ? `<ul>${arr(s.bullets).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</section>`).join("")}
        ${arr(d.key_terms).length ? `<section class="stack-s"><h3>Key terms</h3><dl class="terms">${arr(d.key_terms).map(k => `<dt>${esc(k.term)}</dt><dd>${esc(k.definition)}</dd>`).join("")}</dl></section>` : ""}
        ${arr(d.common_mistakes).length ? `<section class="stack-s"><h3>Common mistakes</h3><ul>${arr(d.common_mistakes).map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
      </div>
      <div data-pane="watch" hidden class="stack">
        <p class="small">Pick one video of about 5 to 10 minutes. Check the title mentions GCSE and your exam board before you start.</p>
        <div class="vids">${vids}</div>
      </div>
    </div>
    <div class="row"><button class="btn primary" type="button" id="recallStart">I'm ready: hide it and start writing</button></div>
    <div class="paper" id="recallBox" hidden>
      <h3>Write down everything you remember</h3>
      <p class="small">Headings, lists, equations, quotations. Don't look back until the 15 minutes are up.</p>
      <label for="recallText" class="small">Your recall</label>
      <textarea id="recallText" placeholder="Start with the main idea, then add every detail you can..."></textarea>
      <div class="row"><button class="btn" type="button" id="recallCheck">Show the summary to check</button></div>
      <p class="small" id="recallNote" hidden>Now compare. Add anything you missed in a different colour; those points go first in your next review.</p>
    </div>`;
  }

  function quizHTML(w, d) {
    const qs = arr(d.questions).slice(0, 20);
    const sets = [0,1,2,3].map(s => qs.slice(s*5, s*5+5)).filter(x => x.length);
    return `<ol class="steps">
      <li><div><b>Answer five from memory</b><span>reveal each answer</span></div></li>
      <li><div><b>Mark yourself honestly</b><span>got it / missed it</span></div></li>
      <li><div><b>Repeat the ones you missed</b><span>until the set is all correct</span></div></li>
    </ol>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="quiz" aria-selected="true">Self-quiz</button>
      <button type="button" role="tab" data-tab="table" aria-selected="false">Question and answer sheet</button>
    </div>
    <div data-pane="quiz" class="stack">
      ${sets.map((set, si) => `<div class="paper qset" id="set${si}">
        <div class="qset-head"><h3>Set ${si+1}</h3><span id="setStatus${si}" class="small">Questions ${si*5+1} to ${si*5+set.length}</span></div>
        ${set.map((q, i) => { const n = si*5+i; return `<div class="qrow" id="qr${n}">
          <span class="num">${n+1}</span>
          <div><div class="q">${esc(q.q)}</div>
            <button class="btn" type="button" data-show>Show answer</button>
            <div class="a" hidden>${esc(q.a)}</div>
            <div class="mark" hidden><button class="btn" type="button" data-mark="right" data-n="${n}">Got it</button><button class="btn" type="button" data-mark="wrong" data-n="${n}">Missed it</button></div>
          </div></div>`; }).join("")}
        <div class="row" id="setFoot${si}"></div>
      </div>`).join("")}
    </div>
    <div data-pane="table" hidden class="paper">
      <p class="small">Fold or cover the answer column, answer five at a time, then check.</p>
      <div class="scroll"><table class="qtable"><thead><tr><th>#</th><th>Question</th><th>Answer</th></tr></thead>
      <tbody>${qs.map((q, i) => `<tr><td class="n">${i+1}</td><td>${esc(q.q)}</td><td>${esc(q.a)}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
  }

  function examHTML(w, d) {
    const qs = arr(d.questions), ms = arr(d.mark_scheme);
    const total = +d.total_marks || qs.reduce((a, q) => a + (+q.marks || 0), 0);
    return `<div class="paper">
      <div class="qset-head"><h3>Questions</h3><span class="small">Total ${total} marks</span></div>
      ${d.timing_note ? `<p class="small">${esc(d.timing_note)}</p>` : ""}
      <p class="small">Write your answers on paper. There are no answer spaces on this sheet.</p>
      ${arr(d.sources).map(s => `<div class="source"><h4>${esc(s.label)}${s.title ? ": " + esc(s.title) : ""}</h4><p>${esc(s.text)}</p></div>`).join("")}
      ${qs.map(q => `<div class="exq"><span class="num">${esc(q.number)}</span><div class="stack-s"><p>${esc(q.text)}</p>${tableHTML(q.table)}</div><span class="mk">${marksLabel(w, +q.marks || 0)}</span></div>`).join("")}
    </div>
    <div class="flip"><button class="btn primary" type="button" id="flipBtn">Turn over: show the mark scheme</button></div>
    <div class="paper" id="markScheme" hidden>
      <div class="qset-head"><h3>Mark scheme</h3><span class="small">Your score: <b id="scoreTotal">0</b> / ${total}</span></div>
      ${ms.map(m => `<div class="exq"><span class="num">${esc(m.number)}</span>
        <div class="stack-s"><ul>${arr(m.points).map(p => `<li>${esc(p)}</li>`).join("")}</ul>${m.guidance ? `<p class="small">${esc(m.guidance)}</p>` : ""}</div>
        <label class="score"><input type="number" min="0" max="${+m.marks || 0}" inputmode="numeric" data-score aria-label="Marks for ${esc(m.number)}"> / ${+m.marks || 0}</label></div>`).join("")}
    </div>`;
  }

  function worksheetHTML(w, d) {
    return w.format === "Review" ? reviewHTML(w, d) : w.format === "Quiz" ? quizHTML(w, d) : examHTML(w, d);
  }

  // Print layout: front side, then the reverse on a new page.
  function printHTML(w, d) {
    const head = `${esc(w.subjectLabel)} · ${esc(w.specLabel)}${w.tier ? " · " + esc(w.tier) : ""} · ${esc(w.format)} · 30 minutes`;
    let front = "", back = "";
    if (w.format === "Review") {
      front = `<ol class="p-steps"><li>Read for 8 minutes.</li><li>Turn over and write everything you remember for 15 minutes.</li><li>Check and add what you missed in a different colour for 7 minutes.</li></ol>` +
        arr(d.summary).map(s => `<h3>${esc(s.heading)}</h3>${arr(s.paragraphs).map(p => `<p>${esc(p)}</p>`).join("")}${arr(s.bullets).length ? `<ul>${arr(s.bullets).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`).join("") +
        (arr(d.key_terms).length ? `<h3>Key terms</h3><table>${arr(d.key_terms).map(k => `<tr><th>${esc(k.term)}</th><td>${esc(k.definition)}</td></tr>`).join("")}</table>` : "") +
        (arr(d.common_mistakes).length ? `<h3>Common mistakes</h3><ul>${arr(d.common_mistakes).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
      back = `<h2>What I remember</h2><div class="p-lines"></div>`;
    } else if (w.format === "Quiz") {
      const qs = arr(d.questions).slice(0, 20);
      front = `<p class="p-note">Fold along the dashed line to hide the answers. Answer five at a time, check, and repeat any you got wrong.</p><table class="p-quiz"><thead><tr><th>#</th><th>Question</th><th class="ans">Answer</th></tr></thead><tbody>${qs.map((q, i) => `<tr class="${i % 5 === 0 && i ? "setbreak" : ""}"><td>${i+1}</td><td>${esc(q.q)}</td><td class="ans">${esc(q.a)}</td></tr>`).join("")}</tbody></table>`;
    } else {
      const total = +d.total_marks || arr(d.questions).reduce((a, q) => a + (+q.marks || 0), 0);
      front = (d.timing_note ? `<p class="p-note">${esc(d.timing_note)}</p>` : "") + `<p class="p-note">Total ${total} marks. Answer on lined paper.</p>` +
        arr(d.sources).map(s => `<div class="p-src"><b>${esc(s.label)}${s.title ? ": " + esc(s.title) : ""}</b><p>${esc(s.text)}</p></div>`).join("") +
        arr(d.questions).map(q => `<div class="p-q"><span class="qn">${esc(q.number)}</span><div><p>${esc(q.text)}</p>${tableHTML(q.table, "")}</div><span class="qm">${marksLabel(w, +q.marks || 0)}</span></div>`).join("");
      back = `<h2>Mark scheme</h2>` + arr(d.mark_scheme).map(m => `<div class="p-q"><span class="qn">${esc(m.number)}</span><div><ul>${arr(m.points).map(p => `<li>${esc(p)}</li>`).join("")}</ul>${m.guidance ? `<p class="p-note">${esc(m.guidance)}</p>` : ""}</div><span class="qm">${+m.marks || 0}</span></div>`).join("");
    }
    return `<header class="p-head"><small>${head}</small><h1>${esc(w.topic)}</h1><small>${esc(w.unit)}</small></header>${front}` +
      (back ? `<section class="p-reverse"><header class="p-head"><small>${head} · Reverse</small><h1>${esc(w.topic)}</h1></header>${back}</section>` : "");
  }

  const api = { SUBJECTS, SUBJ, FORMATS, FORMAT_INFO, POEMS, pool, worksheetSpec, allWorksheets, buildPrompt, validate,
    worksheetHTML, printHTML, esc, fnv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GCSE = api;
})(typeof window !== "undefined" ? window : globalThis);
