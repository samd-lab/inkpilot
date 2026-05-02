/**
 * TattooDesignr — Master Prompt Library
 *
 * This is the conversion-and-quality moat. Every output the user sees is a
 * function of these prompts + the LoRA weights below. Tune ruthlessly.
 *
 * Validated 2026-05 against:
 *  - FLUX.1-dev (replicate: black-forest-labs/flux-dev)
 *  - FLUX-tattoo LoRA (civitai 740274)
 *  - Trad-japanese full-sleeve LoRA (civitai 758647)
 *  - DP Tattoo Sketch Minimal Line LoRA (civitai 1385972)
 *
 * Each style has:
 *  - base   : core aesthetic clauses (style + medium + lineweight + palette)
 *  - suffix : composition + framing + resolution + technical
 *  - negative: what we forbid (skin, photo, body, watercolor when wrong, etc.)
 *  - lora   : Replicate or HF LoRA reference (optional)
 *  - weight : LoRA strength
 */

const STYLE_CONFIGS = {
  traditional: {
    label: 'American Traditional',
    base: 'american traditional tattoo flash, bold thick black outlines with consistent line weight, classic Sailor Jerry palette of solid red yellow forest green royal blue, simple flat shading, iconic centered composition, Norman Collins inspired, vintage tattoo flash sheet aesthetic, hand-drawn ink illustration, high contrast',
    suffix: 'on clean white paper background, professional tattoo flash, vector-clean lines, 1:1 square framing, sharp focus, perfectly centered subject',
    negative: 'photorealistic, 3d render, photograph, watercolor, soft gradients, blurry, low detail, body, skin, human, person, model, mannequin, signature, watermark, text, frame, border, double exposure',
    lora: 'civitai:740274',
    weight: 0.85,
  },
  neo: {
    label: 'Neo-Traditional',
    base: 'neo-traditional tattoo design, refined bold outlines with thinner detailed inner linework, expanded painterly color palette of teal magenta amber gold deep purple, ornamental decorative elements, gem and jewel accents with light reflections, depth shading and dimension, illustrative storytelling composition',
    suffix: 'on clean white background, painterly tattoo flash, 1:1 square framing, sharp clean lines, perfectly centered',
    negative: 'photorealistic, photograph, blurry, soft photo edges, body, skin, human, mannequin, signature, watermark, text',
    lora: 'civitai:740274',
    weight: 0.7,
  },
  japanese: {
    label: 'Japanese / Irezumi',
    base: 'traditional Japanese irezumi tattoo, bold black outlines (sumi-style), dynamic flowing composition with wind bars finger waves stylized clouds and cherry blossoms, deep saturated reds blacks oranges accent gold, ukiyo-e woodblock print influence, Horiyoshi III inspired, tebori hand-poked aesthetic, mythological storytelling',
    suffix: 'full flash sheet composition, 1:1 square framing, clean white background, sharp ink lines, dramatic dynamic posing',
    negative: 'western american tattoo, photorealistic, soft photo edges, blurry, body, skin, human, mannequin, signature, watermark, text, kanji errors',
    lora: 'civitai:758647',
    weight: 0.75,
  },
  minimalist: {
    label: 'Minimalist',
    base: 'minimalist single-needle fine line tattoo, ultra thin clean unbroken black ink line on pure white, negative space composition, modern geometric simplicity, hand-drawn continuous line, zero fill or shading, elegant and quiet',
    suffix: '1:1 square framing, perfect centered composition, tattoo stencil style, monochrome black on bright white background, sharp pixel-clean lines',
    negative: 'thick bold lines, color, color fill, color shading, photorealistic, gradients, complex busy detail, multiple subjects, watercolor, body, skin, person, signature, text',
    lora: 'civitai:1385972',
    weight: 0.9,
  },
  fineline: {
    label: 'Fine Line',
    base: 'fine line tattoo, single-needle ultra-thin precise black ink linework, delicate intricate hand-drawn detail, subtle dotwork shading and stippling, romantic elegant botanical or anatomical subject, modern feminine fine art tattoo aesthetic',
    suffix: 'on clean white background, fine line tattoo flash, 1:1 square framing, perfectly centered, sharp sketch-precision lines',
    negative: 'thick bold lines, solid color fills, photorealistic, photograph, blurry, body, skin, human, mannequin, signature, watermark',
    lora: 'civitai:1385972',
    weight: 0.7,
  },
  blackwork: {
    label: 'Blackwork',
    base: 'blackwork tattoo, heavy solid black ink saturation contrasted with sharp negative space, bold geometric and ornamental sacred-geometry patterns, intricate dotwork stippling and crosshatch textures, mandala and sacred-geometric influences, dark tribal bold high-contrast composition',
    suffix: 'on clean white background, blackwork flash sheet, 1:1 square framing, perfectly centered, ultra-sharp precise edges',
    negative: 'color, watercolor, soft photo edges, photorealistic, photograph, gradients, body, skin, human, signature, watermark',
    lora: 'civitai:740274',
    weight: 0.6,
  },
  watercolor: {
    label: 'Watercolor',
    base: 'watercolor tattoo design, vibrant flowing translucent paint splashes washes and bleeds, expressive impressionist brush strokes, dreamy ethereal painterly composition, modern artistic watercolor tattoo aesthetic, optionally with delicate fine-line accents',
    suffix: 'on clean white background, watercolor tattoo flash, 1:1 square framing, perfectly centered, soft edge wash blending into crisp detail',
    negative: 'thick bold black outlines, geometric, photorealistic, photograph, dirty muddy colors, body, skin, human, signature, watermark',
    lora: 'civitai:740274',
    weight: 0.5,
  },
  realism: {
    label: 'Black & Grey Realism',
    base: 'photorealistic black and grey tattoo, hyperdetailed realistic shading and depth, professional smooth gradient single-pin shading, dramatic chiaroscuro lighting, masterful portrait or natural subject rendering, micro-realism precision, Nikko Hurtado and Niki Norberg inspired technique',
    suffix: 'on clean white background, realism tattoo flash, 1:1 square framing, perfectly centered, ultra-high detail and tonal range',
    negative: 'cartoon, illustration, color, line art, geometric, watercolor, simple, low detail, blurry, soft focus, body, skin, human face partial, signature, watermark',
    lora: null,
    weight: 0,
  },
  tribal: {
    label: 'Tribal',
    base: 'polynesian tribal tattoo, bold solid black geometric patterns, traditional Marquesan Maori Samoan motifs, sharp angular interlocking lines, sacred symbols storytelling glyphs and pattern bands, high contrast solid black on white',
    suffix: 'on clean white background, tribal flash, 1:1 square framing, perfectly centered, mathematically precise edges',
    negative: 'color, photorealistic, soft photo edges, gradients, body, skin, human, signature, watermark, illustrated',
    lora: 'civitai:740274',
    weight: 0.6,
  },
  dotwork: {
    label: 'Dotwork',
    base: 'dotwork tattoo, intricate stippling shading composed entirely of tiny precise black ink dots, sacred geometry mandala and ornamental patterns, high contrast detailed pointillism style, ritual ornamental design, monochrome',
    suffix: 'on clean white background, dotwork stipple flash, 1:1 square framing, perfectly centered, sharp dot precision',
    negative: 'solid black fills, color, photorealistic, soft photo edges, gradients, body, skin, human, signature, watermark',
    lora: 'civitai:740274',
    weight: 0.55,
  },
};

/**
 * Build a Replicate-ready prompt object from user input.
 * FLUX.1-dev does not accept `negative_prompt`; we fold negatives into the
 * positive prompt as an "AVOID:" suffix (which FLUX respects well).
 *
 * Returns { positive, styleLabel } — ready to drop into Replicate input.prompt.
 */
function buildPrompt({ idea, style, placement = '', referenceDescription = '' }) {
  const cfg = STYLE_CONFIGS[style] || STYLE_CONFIGS.traditional;
  const ideaClean = (idea || 'classic tattoo design').trim().slice(0, 240);
  const placementClause = placement ? ` intended placement: ${placement},` : '';
  const refClause = referenceDescription ? ` inspired by: ${referenceDescription},` : '';

  const corePrompt = [
    cfg.base,
    `subject: ${ideaClean}`,
    refClause,
    placementClause,
    cfg.suffix,
  ].join(', ').replace(/\s+/g, ' ').replace(/,\s*,/g, ',').trim();

  // FLUX-friendly negative folding
  const positive = `${corePrompt}. AVOID: ${cfg.negative}.`;

  return {
    positive,
    styleLabel: cfg.label,
    // legacy fields kept for callers; safe to ignore
    negative: cfg.negative,
    lora: cfg.lora,
    loraWeight: cfg.weight,
  };
}

/**
 * The 40-design master gallery seed.
 * Run scripts/generate-gallery.js with these to populate /images/examples/.
 */
const GALLERY_DESIGNS = [
  // Traditional (5)
  { id: 'trad-01', style: 'traditional', idea: 'a classic anchor wrapped in rope with a red rose and waves', label: 'Anchor & Rose' },
  { id: 'trad-02', style: 'traditional', idea: 'a swallow in flight holding a banner that reads HOME, with stars', label: 'Swallow & Banner' },
  { id: 'trad-03', style: 'traditional', idea: 'a black panther head growling with bared fangs and bold yellow eyes', label: 'Black Panther' },
  { id: 'trad-04', style: 'traditional', idea: 'a dagger piercing through a red heart, blood drops, banner reading TRUE LOVE', label: 'Dagger Heart' },
  { id: 'trad-05', style: 'traditional', idea: 'an american eagle with spread wings holding red roses, classic flash style', label: 'Eagle of Liberty' },

  // Neo-Traditional (4)
  { id: 'neo-01', style: 'neo', idea: 'an art-deco fox surrounded by ornate flowers gemstones and gold leaf accents', label: 'Ornate Fox' },
  { id: 'neo-02', style: 'neo', idea: 'a wolf head with crystalline gemstones and cosmic flowers woven into its fur', label: 'Crystal Wolf' },
  { id: 'neo-03', style: 'neo', idea: 'a deer skull antlers wrapped in vines blooming with wildflowers and amethyst gems', label: 'Stag Skull' },
  { id: 'neo-04', style: 'neo', idea: 'an octopus tentacle wrapped around a vintage brass nautical compass with rope details', label: 'Octopus Compass' },

  // Japanese (5)
  { id: 'jp-01', style: 'japanese', idea: 'a dynamic koi fish swimming up against crashing waves transforming into a dragon', label: 'Koi Dragon' },
  { id: 'jp-02', style: 'japanese', idea: 'a fierce Hannya mask with cherry blossom petals falling around it and red horns', label: 'Hannya Mask' },
  { id: 'jp-03', style: 'japanese', idea: 'a roaring tiger crouching among bamboo and stylized clouds', label: 'Tiger & Bamboo' },
  { id: 'jp-04', style: 'japanese', idea: 'a samurai warrior holding a katana under cherry blossom petals, dramatic pose', label: 'Samurai' },
  { id: 'jp-05', style: 'japanese', idea: 'a foo dog guardian lion with flames and peony flowers, traditional pose', label: 'Foo Dog' },

  // Minimalist (4)
  { id: 'min-01', style: 'minimalist', idea: 'a mountain range with a crescent moon above, single continuous unbroken line', label: 'Mountain Moon' },
  { id: 'min-02', style: 'minimalist', idea: 'a tiny ocean wave with a sun above it, geometric arc shapes only', label: 'Sunset Wave' },
  { id: 'min-03', style: 'minimalist', idea: 'a heart drawn in one continuous unbroken line, no lift', label: 'One Line Heart' },
  { id: 'min-04', style: 'minimalist', idea: 'a dragonfly composed of clean precise triangular shapes and thin antennae', label: 'Geometric Dragonfly' },

  // Fine Line (4)
  { id: 'fine-01', style: 'fineline', idea: 'a delicate single-stem rose with leaves, thorns, and small dewdrops', label: 'Single Rose' },
  { id: 'fine-02', style: 'fineline', idea: 'a slender snake coiled around a vertical row of moon phases with tiny stars', label: 'Snake & Moon' },
  { id: 'fine-03', style: 'fineline', idea: 'a botanical lavender sprig with tiny dotwork shading and small flying bee', label: 'Lavender' },
  { id: 'fine-04', style: 'fineline', idea: 'a butterfly with extremely intricate wing patterns and antennae', label: 'Butterfly' },

  // Blackwork (4)
  { id: 'bw-01', style: 'blackwork', idea: 'a sacred geometry mandala with intricate ornamental sun-ray patterns', label: 'Sacred Mandala' },
  { id: 'bw-02', style: 'blackwork', idea: 'a raven perched on a crescent moon surrounded by stars and ornate filigree', label: 'Raven & Moon' },
  { id: 'bw-03', style: 'blackwork', idea: 'an all-seeing eye inside a triangle with rays of light and ornate frame', label: 'All Seeing Eye' },
  { id: 'bw-04', style: 'blackwork', idea: 'an ornate skull with intricate decorative patterns roses and filigree forehead', label: 'Ornate Skull' },

  // Watercolor (3)
  { id: 'wc-01', style: 'watercolor', idea: 'a phoenix rising in flames with vibrant red orange yellow paint splashes', label: 'Phoenix' },
  { id: 'wc-02', style: 'watercolor', idea: 'a hummingbird drinking nectar from a flower with rainbow paint splashes', label: 'Hummingbird' },
  { id: 'wc-03', style: 'watercolor', idea: 'an abstract galaxy with planets nebula and starbursts, cosmic colors', label: 'Galaxy' },

  // Realism (4)
  { id: 'real-01', style: 'realism', idea: 'a hyperrealistic male lion portrait with detailed mane and intense eyes', label: 'Lion King' },
  { id: 'real-02', style: 'realism', idea: 'a clock face frozen at 4:20, glass cracked, gears visible behind, smoke curling', label: 'Frozen Clock' },
  { id: 'real-03', style: 'realism', idea: 'a lone wolf howling at a full moon, hyper-detailed fur shading', label: 'Lone Wolf' },
  { id: 'real-04', style: 'realism', idea: 'a hyperrealistic human eye with detailed iris reflections and eyelashes', label: 'The Eye' },

  // Tribal (3)
  { id: 'trib-01', style: 'tribal', idea: 'a polynesian shoulder armor pattern with sun ocean wave and shark tooth motifs', label: 'Tribal Shoulder' },
  { id: 'trib-02', style: 'tribal', idea: 'a maori manta ray covered in kirituhi spiral patterns', label: 'Manta Ray' },
  { id: 'trib-03', style: 'tribal', idea: 'a samoan warrior emblem with crossed spears and tribal rosettes', label: 'Warrior Emblem' },

  // Dotwork (3)
  { id: 'dot-01', style: 'dotwork', idea: 'a stippled crescent moon with detailed lunar surface craters and texture', label: 'Stippled Moon' },
  { id: 'dot-02', style: 'dotwork', idea: 'a sacred geometry flower of life pattern in pure dotwork stippling', label: 'Flower of Life' },
  { id: 'dot-03', style: 'dotwork', idea: 'a stippled honeybee with hexagonal honeycomb background', label: 'Honeybee' },
];

module.exports = { STYLE_CONFIGS, buildPrompt, GALLERY_DESIGNS };
