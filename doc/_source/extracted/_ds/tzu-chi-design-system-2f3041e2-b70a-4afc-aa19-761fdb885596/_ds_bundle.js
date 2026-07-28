/* @ds-bundle: {"format":3,"namespace":"TzuChiDesignSystem_2f3041","components":[{"name":"Aphorism","sourcePath":"components/brand/Aphorism.jsx"},{"name":"LotusMark","sourcePath":"components/brand/LotusMark.jsx"},{"name":"MissionCard","sourcePath":"components/brand/MissionCard.jsx"},{"name":"Roofline","sourcePath":"components/brand/Roofline.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Stat","sourcePath":"components/core/Stat.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"}],"sourceHashes":{"components/brand/Aphorism.jsx":"7d4b1e621b3d","components/brand/LotusMark.jsx":"d2683a28b99e","components/brand/MissionCard.jsx":"98d43270e746","components/brand/Roofline.jsx":"ee5282d46bb3","components/core/Button.jsx":"6a9a9c0dcc32","components/core/Card.jsx":"da2ce69fa21f","components/core/Eyebrow.jsx":"cd9cd012c1d5","components/core/Stat.jsx":"6d8a6692eae9","components/core/Tag.jsx":"f81f07afa35e","ui_kits/foundation-site/Footer.jsx":"3bd5640d0169","ui_kits/foundation-site/Gallery.jsx":"d819b3e827ae","ui_kits/foundation-site/Header.jsx":"2bbf072ea963","ui_kits/foundation-site/Hero.jsx":"05ee2888e2e4","ui_kits/foundation-site/Missions.jsx":"6e2be721f8c7","ui_kits/foundation-site/Story.jsx":"ccfa4094db79"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TzuChiDesignSystem_2f3041 = window.TzuChiDesignSystem_2f3041 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Aphorism.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Jing Si Aphorism band — the contemplative pause. Chinese in the brush face
 * above a faithful English translation in serif italic, attributed to Dharma
 * Master Cheng Yen. tone "light" (paper) or "inverse" (navy).
 */
function Aphorism({
  zh,
  en,
  by = "Dharma Master Cheng Yen",
  source = "靜思語 Jing Si Aphorisms",
  tone = "light",
  style,
  ...rest
}) {
  const isInverse = tone === "inverse";
  const zhColor = isInverse ? "var(--tc-white)" : "var(--tc-navy)";
  const enColor = isInverse ? "var(--tc-cloud)" : "var(--tc-navy-deep)";
  const byColor = isInverse ? "var(--tc-text-on-inverse-muted)" : "var(--tc-text-subtle)";
  return /*#__PURE__*/React.createElement("figure", _extends({
    style: {
      margin: 0,
      textAlign: "center",
      background: isInverse ? "var(--tc-surface-inverse)" : "var(--tc-white)",
      borderBlock: isInverse ? "none" : "1px solid var(--tc-border)",
      padding: "clamp(2rem, 1.5rem + 3vw, 3.5rem) var(--tc-gutter)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("p", {
    lang: "zh-Hant",
    style: {
      margin: 0,
      fontFamily: "var(--tc-font-brush)",
      fontSize: "var(--tc-fs-aphorism-zh)",
      color: zhColor,
      letterSpacing: "var(--tc-tracking-brush)",
      lineHeight: 1.5
    }
  }, zh), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: "1.1rem auto .9rem",
      maxWidth: "30ch",
      fontFamily: "var(--tc-font-display)",
      fontStyle: "italic",
      fontSize: "var(--tc-fs-aphorism-en)",
      color: enColor,
      lineHeight: "var(--tc-lh-snug)"
    }
  }, en), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      fontSize: "var(--tc-fs-caption)",
      letterSpacing: "var(--tc-tracking-caps)",
      textTransform: "uppercase",
      color: byColor
    }
  }, by, source && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--tc-font-zh)"
    }
  }, " · ", source)));
}
Object.assign(__ds_scope, { Aphorism });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Aphorism.jsx", error: String((e && e.message) || e) }); }

// components/brand/LotusMark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Original lotus-and-ship mark — eight petals (the Noble Eightfold Path), a
 * gold seed-heart, and a ship that ferries beings across suffering. An
 * original illustration that evokes, and never reproduces, the registered logo.
 * tone "navy" for light backgrounds, "sky" for dark.
 */
function LotusMark({
  size = 40,
  tone = "navy",
  style,
  ...rest
}) {
  const petal = tone === "sky" ? "#4A78B0" : "#1B2A4A";
  const boat = tone === "sky" ? "#FFFFFF" : "#16223B";
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 64 64",
    width: size,
    height: size,
    role: "img",
    "aria-label": "Tzu Chi lotus and ship mark",
    style: {
      display: "block",
      flex: "none",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("g", {
    fill: petal
  }, angles.map(a => /*#__PURE__*/React.createElement("path", {
    key: a,
    d: "M32 7 C25 19,25 28,32 33 C39 28,39 19,32 7 Z",
    transform: `rotate(${a} 32 33)`
  }))), /*#__PURE__*/React.createElement("circle", {
    cx: "32",
    cy: "33",
    r: "7",
    fill: "#C9A24B"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M27 32 Q32 36 37 32 L35.5 34.5 Q32 37.5 28.5 34.5 Z",
    fill: boat
  }), tone !== "sky" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M32 25 L32 32",
    stroke: "#16223B",
    strokeWidth: "1.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M32 25 L36 31 L32 31 Z",
    fill: "#16223B"
  })));
}
Object.assign(__ds_scope, { LotusMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/LotusMark.jsx", error: String((e && e.message) || e) }); }

// components/brand/Roofline.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The "人" (human) roofline — the signature Jing Si Hall eave. A quiet section
 * divider or footer motif. Renders in sky blue by default.
 */
function Roofline({
  width = 120,
  color = "var(--tc-sky)",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 120 40",
    width: width,
    height: width * 40 / 120,
    fill: "none",
    stroke: color,
    strokeWidth: "2.2",
    strokeLinecap: "round",
    role: "img",
    "aria-label": "Jing Si Hall roofline",
    style: {
      display: "block",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("path", {
    d: "M8 36 L60 8 L112 36"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M44 22 L60 8 L76 22",
    opacity: ".5"
  }));
}
Object.assign(__ds_scope, { Roofline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Roofline.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tzu Chi primary action button. Bamboo-green pill, white text, gentle
 * hover-lift. Variants honor the "white-dominant, navy-grounded" palette.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  type = "button",
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: ".55rem 1.1rem",
      fontSize: ".9rem"
    },
    md: {
      padding: ".8rem 1.45rem",
      fontSize: ".98rem"
    },
    lg: {
      padding: "1rem 1.9rem",
      fontSize: "1.05rem"
    }
  };
  const variants = {
    primary: {
      background: "var(--tc-action)",
      color: "var(--tc-action-text)",
      borderColor: "transparent"
    },
    secondary: {
      background: "transparent",
      color: "var(--tc-navy)",
      borderColor: "var(--tc-navy)"
    },
    ghost: {
      background: "transparent",
      color: "var(--tc-navy)",
      borderColor: "transparent"
    },
    onNavy: {
      background: "var(--tc-white)",
      color: "var(--tc-navy)",
      borderColor: "transparent"
    },
    ghostLight: {
      background: "transparent",
      color: "var(--tc-white)",
      borderColor: "rgba(255,255,255,.6)"
    }
  };
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: ".5rem",
    fontFamily: "var(--tc-font-body)",
    fontWeight: "var(--tc-fw-semibold)",
    lineHeight: 1,
    borderRadius: "var(--tc-radius-pill)",
    border: "var(--tc-border-width-strong) solid transparent",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background-color var(--tc-dur-fast) var(--tc-ease), color var(--tc-dur-fast) var(--tc-ease), border-color var(--tc-dur-fast) var(--tc-ease), transform var(--tc-dur-fast) var(--tc-ease)",
    ...sizes[size],
    ...variants[variant],
    ...style
  };
  const hoverIn = e => {
    if (disabled) return;
    if (variant === "primary") {
      e.currentTarget.style.background = "var(--tc-action-hover)";
      e.currentTarget.style.transform = "translateY(-1px)";
    } else if (variant === "secondary") {
      e.currentTarget.style.background = "var(--tc-navy)";
      e.currentTarget.style.color = "var(--tc-white)";
    } else if (variant === "ghost") {
      e.currentTarget.style.background = "var(--tc-stone-soft)";
    } else if (variant === "onNavy") {
      e.currentTarget.style.background = "var(--tc-cloud)";
    } else if (variant === "ghostLight") {
      e.currentTarget.style.background = "rgba(255,255,255,.12)";
      e.currentTarget.style.borderColor = "var(--tc-white)";
    }
  };
  const hoverOut = e => {
    Object.assign(e.currentTarget.style, {
      background: variants[variant].background,
      color: variants[variant].color,
      borderColor: variants[variant].borderColor,
      transform: "none"
    });
  };
  const Tag = href ? "a" : "button";
  const tagProps = href ? {
    href
  } : {
    type,
    disabled
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: base,
    onClick: onClick,
    onMouseEnter: hoverIn,
    onMouseLeave: hoverOut
  }, tagProps, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Soft white surface with a hairline stone border and a low navy-tinted
 * shadow. Optional hover-lift for interactive cards.
 */
function Card({
  children,
  interactive = false,
  padded = true,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      background: "var(--tc-surface-card)",
      border: "var(--tc-border-width) solid var(--tc-border)",
      borderRadius: "var(--tc-radius)",
      padding: padded ? "1.6rem 1.4rem 1.7rem" : 0,
      boxShadow: hover ? "var(--tc-shadow-card)" : "var(--tc-shadow-soft)",
      transform: hover ? "translateY(-4px)" : "none",
      transition: "transform var(--tc-dur-base) var(--tc-ease), box-shadow var(--tc-dur-base) var(--tc-ease)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/brand/MissionCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ICONS = {
  charity: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M24 19c-2-4-9-4-9 2 0 5 9 10 9 10s9-5 9-10c0-6-7-6-9-2Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 33c5 5 25 5 30 0"
  })),
  medicine: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "24",
    cy: "24",
    r: "13"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M24 18v12M18 24h12"
  })),
  education: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M24 16c-4-3-12-3-15-1v20c3-2 11-2 15 1 4-3 12-3 15-1V15c-3-2-11-2-15 1Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M24 16v21"
  })),
  culture: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M31 11l6 6-18 18-7 1 1-7Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 37c3 1 6 0 7-3"
  }))
};

/**
 * A Four-Missions card: line icon, bilingual title, short description.
 * `icon` is one of charity | medicine | education | culture, or a node.
 */
function MissionCard({
  icon,
  title,
  zh,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    interactive: true,
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "block",
      width: 46,
      height: 46,
      color: "var(--tc-navy)",
      marginBottom: "1.1rem"
    }
  }, typeof icon === "string" ? /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      width: "100%",
      height: "100%"
    }
  }, ICONS[icon]) : icon), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 .5rem",
      fontFamily: "var(--tc-font-display)",
      fontSize: "var(--tc-fs-h3)",
      fontWeight: "var(--tc-fw-semibold)",
      color: "var(--tc-navy)",
      display: "flex",
      alignItems: "baseline",
      gap: ".5rem"
    }
  }, title, zh && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--tc-font-zh)",
      fontSize: ".92rem",
      color: "var(--tc-bamboo-deep)",
      fontWeight: "var(--tc-fw-semibold)"
    }
  }, zh)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: ".98rem",
      color: "var(--tc-text-muted)",
      lineHeight: "var(--tc-lh-body)"
    }
  }, children));
}
Object.assign(__ds_scope, { MissionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/MissionCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Uppercase eyebrow label that sits above section titles. Optional Chinese
 * term renders in the quieter ZH face. Bamboo-green by default.
 */
function Eyebrow({
  children,
  zh,
  tone = "accent",
  style,
  ...rest
}) {
  const tones = {
    accent: "var(--tc-text-accent)",
    subtle: "var(--tc-text-subtle)",
    onInverse: "var(--tc-text-on-inverse-muted)"
  };
  return /*#__PURE__*/React.createElement("p", _extends({
    style: {
      margin: "0 0 .9rem",
      fontFamily: "var(--tc-font-body)",
      fontSize: "var(--tc-fs-eyebrow)",
      fontWeight: "var(--tc-fw-semibold)",
      letterSpacing: "var(--tc-tracking-eyebrow)",
      textTransform: "uppercase",
      color: tones[tone],
      ...style
    }
  }, rest), children, zh && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--tc-font-zh)",
      letterSpacing: ".06em",
      color: "var(--tc-text-subtle)"
    }
  }, " · ", zh));
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A single statistic: serif numeral in bamboo-deep over a quiet grey label.
 * Used in stat rows beneath the founding-story copy.
 */
function Stat({
  value,
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--tc-font-display)",
      fontSize: "1.8rem",
      fontWeight: "var(--tc-fw-semibold)",
      color: "var(--tc-bamboo-deep)",
      lineHeight: 1.1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--tc-font-body)",
      fontSize: "var(--tc-fs-caption)",
      letterSpacing: ".06em",
      color: "var(--tc-text-subtle)",
      marginTop: ".25rem"
    }
  }, label));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Stat.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Small pill tag / badge. tone "accent" = bamboo, "sky", "gold", "neutral".
 * "soft" fills use a tinted background; "outline" uses a hairline border.
 */
function Tag({
  children,
  tone = "neutral",
  appearance = "soft",
  style,
  ...rest
}) {
  const map = {
    neutral: {
      fg: "var(--tc-grey)",
      bg: "var(--tc-stone-soft)",
      bd: "var(--tc-stone)"
    },
    accent: {
      fg: "var(--tc-bamboo-deep)",
      bg: "#E7EFE7",
      bd: "var(--tc-bamboo)"
    },
    sky: {
      fg: "var(--tc-navy)",
      bg: "var(--tc-cloud)",
      bd: "var(--tc-sky)"
    },
    gold: {
      fg: "#7A5E17",
      bg: "#F4ECD7",
      bd: "var(--tc-gold)"
    }
  };
  const c = map[tone];
  const appearanceStyle = appearance === "outline" ? {
    background: "transparent",
    border: `1px solid ${c.bd}`,
    color: c.fg
  } : {
    background: c.bg,
    border: "1px solid transparent",
    color: c.fg
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: ".35rem",
      fontFamily: "var(--tc-font-body)",
      fontSize: ".72rem",
      fontWeight: "var(--tc-fw-semibold)",
      letterSpacing: ".08em",
      textTransform: "uppercase",
      padding: ".22rem .6rem",
      borderRadius: "var(--tc-radius-pill)",
      ...appearanceStyle,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Footer.jsx
try { (() => {
// Foundation site — footer + donate modal
const {
  LotusMark: FMark,
  Roofline: FRoof,
  Button: FButton
} = window.TzuChiDesignSystem_2f3041;
function Footer({
  onNav,
  onDonate
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "site-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "roofline-wrap",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(FRoof, {
    width: 120
  })), /*#__PURE__*/React.createElement("div", {
    className: "foot-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-col foot-col--about"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-brand"
  }, /*#__PURE__*/React.createElement(FMark, {
    size: 36,
    tone: "sky"
  }), /*#__PURE__*/React.createElement("span", {
    className: "foot-brand__name"
  }, "Tzu Chi")), /*#__PURE__*/React.createElement("p", {
    className: "foot-about"
  }, "Compassion and relief, carried person to person, drop by drop, in the spirit of Great Love.")), /*#__PURE__*/React.createElement("nav", {
    className: "foot-col",
    "aria-label": "Explore"
  }, /*#__PURE__*/React.createElement("h2", null, "Explore"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#missions",
    onClick: e => {
      e.preventDefault();
      onNav("missions");
    }
  }, "Missions")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#story",
    onClick: e => {
      e.preventDefault();
      onNav("story");
    }
  }, "Our Story")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#involved",
    onClick: e => {
      e.preventDefault();
      onNav("involved");
    }
  }, "Get Involved")))), /*#__PURE__*/React.createElement("nav", {
    className: "foot-col",
    "aria-label": "Connect"
  }, /*#__PURE__*/React.createElement("h2", null, "Connect"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#involved",
    onClick: e => {
      e.preventDefault();
      onNav("involved");
    }
  }, "Volunteer")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onDonate();
    }
  }, "Donate")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#top",
    onClick: e => {
      e.preventDefault();
      onNav("top");
    }
  }, "Back to top"))))), /*#__PURE__*/React.createElement("p", {
    className: "foot-disclaimer"
  }, /*#__PURE__*/React.createElement("strong", null, "Design sample."), " This page is an independent demonstration of a researched, Tzu Chi-inspired visual system. It is not affiliated with, endorsed by or an official property of the Buddhist Tzu Chi Foundation. All motifs are original illustrations and do not reproduce the Foundation's registered logo. Photographs are placeholders. Colors and fonts are a derived interpretation, not an official brand specification.")));
}
function DonateModal({
  onClose
}) {
  const amounts = ["$15", "$30", "$60", "$120"];
  const [active, setActive] = React.useState("$30");
  const [done, setDone] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Donate",
    onClick: e => e.stopPropagation()
  }, done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "modal__title"
  }, "Thank you"), /*#__PURE__*/React.createElement("p", {
    className: "modal__text"
  }, "Your gift of ", active, " gathers with thousands of others, drop by drop. A confirmation would follow in a real flow."), /*#__PURE__*/React.createElement("div", {
    className: "modal__actions"
  }, /*#__PURE__*/React.createElement(FButton, {
    variant: "primary",
    onClick: onClose
  }, "Close"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "modal__title"
  }, "Give to Great Love"), /*#__PURE__*/React.createElement("p", {
    className: "modal__text"
  }, "Small, daily giving gathers into a river. Choose an amount to support the four missions."), /*#__PURE__*/React.createElement("div", {
    className: "amount-row"
  }, amounts.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    className: "amount" + (a === active ? " is-active" : ""),
    onClick: () => setActive(a)
  }, a))), /*#__PURE__*/React.createElement("div", {
    className: "modal__actions"
  }, /*#__PURE__*/React.createElement(FButton, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(FButton, {
    variant: "primary",
    onClick: () => setDone(true)
  }, "Give ", active)))));
}
window.Footer = Footer;
window.DonateModal = DonateModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Gallery.jsx
try { (() => {
// Foundation site — documentary gallery (placeholders) + CTA band
const {
  Eyebrow: GEyebrow,
  Button: GButton,
  Tag: GTag
} = window.TzuChiDesignSystem_2f3041;
const FRAMES = ["Volunteers distribute relief parcels after a typhoon.", "A free clinic in session in an underserved community.", "Sorting recyclables at a community environmental station."];
function Gallery() {
  return /*#__PURE__*/React.createElement("section", {
    className: "section gallery",
    "aria-labelledby": "gallery-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section__head reveal"
  }, /*#__PURE__*/React.createElement(GEyebrow, null, "In the field"), /*#__PURE__*/React.createElement("h2", {
    className: "section__title",
    id: "gallery-title"
  }, "Compassion, documented with dignity"), /*#__PURE__*/React.createElement("p", {
    className: "section__intro"
  }, "Our images show real work and real people, met with respect. The frames below mark where that documentary photography belongs.")), /*#__PURE__*/React.createElement("div", {
    className: "frame-grid"
  }, FRAMES.map(cap => /*#__PURE__*/React.createElement("figure", {
    className: "frame reveal",
    key: cap
  }, /*#__PURE__*/React.createElement("div", {
    className: "frame__ph"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: ".7rem",
      left: ".7rem"
    }
  }, /*#__PURE__*/React.createElement(GTag, {
    tone: "neutral",
    appearance: "soft"
  }, "Image placeholder")), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/icons/image-placeholder.svg",
    alt: ""
  })), /*#__PURE__*/React.createElement("figcaption", {
    className: "frame__cap"
  }, cap))))));
}
function CtaBand({
  onVolunteer,
  onDonate
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "cta-band",
    id: "involved",
    "aria-labelledby": "cta-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap cta-band__inner reveal"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "cta-band__title",
    id: "cta-title"
  }, "Lend your hands to Great Love"), /*#__PURE__*/React.createElement("p", {
    className: "cta-band__text"
  }, "Every volunteer begins with a single act. Join a local team, or support the work with a gift that gathers with thousands of others."), /*#__PURE__*/React.createElement("div", {
    className: "cta-band__actions"
  }, /*#__PURE__*/React.createElement(GButton, {
    variant: "onNavy",
    onClick: onVolunteer
  }, "Become a volunteer"), /*#__PURE__*/React.createElement(GButton, {
    variant: "ghostLight",
    onClick: onDonate
  }, "Donate"))));
}
window.Gallery = Gallery;
window.CtaBand = CtaBand;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Gallery.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Header.jsx
try { (() => {
// Foundation site — header / nav
const {
  Button: TCButton,
  LotusMark: TCMark
} = window.TzuChiDesignSystem_2f3041;
function Header({
  open,
  onToggle,
  onNav,
  onDonate
}) {
  const links = [{
    id: "missions",
    label: "Missions"
  }, {
    id: "story",
    label: "Our Story"
  }, {
    id: "involved",
    label: "Get Involved"
  }];
  return /*#__PURE__*/React.createElement("header", {
    className: "site-header" + (open ? " is-open" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap site-header__inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: "#top",
    onClick: e => {
      e.preventDefault();
      onNav("top");
    },
    "aria-label": "Tzu Chi Foundation home"
  }, /*#__PURE__*/React.createElement(TCMark, {
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    className: "brand__text"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand__name"
  }, "Tzu Chi"), /*#__PURE__*/React.createElement("span", {
    className: "brand__zh"
  }, "\u6148\u6FDF \xB7 FOUNDATION"))), /*#__PURE__*/React.createElement("button", {
    className: "nav-toggle",
    "aria-expanded": open,
    "aria-label": open ? "Close menu" : "Open menu",
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: "2",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M4 12h16M4 17h16"
  }))), /*#__PURE__*/React.createElement("nav", {
    className: "nav",
    "aria-label": "Primary"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "nav__list"
  }, links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l.id
  }, /*#__PURE__*/React.createElement("button", {
    className: "nav__link",
    onClick: () => onNav(l.id)
  }, l.label)))), /*#__PURE__*/React.createElement("span", {
    className: "nav-cta"
  }, /*#__PURE__*/React.createElement(TCButton, {
    variant: "primary",
    size: "sm",
    onClick: onDonate
  }, "Donate")))));
}
window.Header = Header;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Hero.jsx
try { (() => {
// Foundation site — hero (the signature lotus pond)
const {
  Button: HeroButton,
  Eyebrow: HeroEyebrow
} = window.TzuChiDesignSystem_2f3041;
function Hero({
  onNav,
  onVolunteer
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "hero",
    "aria-labelledby": "hero-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__water",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cloud cloud--1",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cloud cloud--2",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cloud cloud--3",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "wrap hero__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero__content"
  }, /*#__PURE__*/React.createElement(HeroEyebrow, {
    zh: "\u4F5B\u6559\u6148\u6FDF\u57FA\u91D1\u6703"
  }, "Buddhist Tzu Chi Foundation"), /*#__PURE__*/React.createElement("h1", {
    className: "hero__title",
    id: "hero-title"
  }, "Where compassion takes shape"), /*#__PURE__*/React.createElement("p", {
    className: "hero__lead"
  }, "Since 1966, volunteers in blue and white have carried Great Love into the places that need it most, through charity, medicine, education and culture."), /*#__PURE__*/React.createElement("div", {
    className: "hero__cta"
  }, /*#__PURE__*/React.createElement(HeroButton, {
    variant: "primary",
    onClick: onVolunteer
  }, "Become a volunteer"), /*#__PURE__*/React.createElement(HeroButton, {
    variant: "secondary",
    onClick: () => onNav("missions")
  }, "Explore our missions"))), /*#__PURE__*/React.createElement("div", {
    className: "hero__scene",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/lotus-ship-hero.svg",
    alt: ""
  }))));
}
window.Hero = Hero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Missions.jsx
try { (() => {
// Foundation site — Four Missions
const {
  Eyebrow: MEyebrow,
  MissionCard: MCard
} = window.TzuChiDesignSystem_2f3041;
const MISSIONS = [{
  icon: "charity",
  title: "Charity",
  zh: "慈善",
  text: "We bring direct relief to families in hardship and to communities struck by disaster, then stay to help them recover."
}, {
  icon: "medicine",
  title: "Medicine",
  zh: "醫療",
  text: "Our hospitals and free clinics treat people regardless of means, joining medical skill with human warmth."
}, {
  icon: "education",
  title: "Education",
  zh: "教育",
  text: "From kindergartens to universities, we teach character alongside knowledge."
}, {
  icon: "culture",
  title: "Humanistic Culture",
  zh: "人文",
  text: "Through media and publishing, we record stories of truth, goodness and beauty."
}];
function Missions() {
  return /*#__PURE__*/React.createElement("section", {
    className: "section missions",
    id: "missions",
    "aria-labelledby": "missions-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section__head reveal"
  }, /*#__PURE__*/React.createElement(MEyebrow, {
    zh: "\u56DB\u5927\u5FD7\u696D"
  }, "Four Missions"), /*#__PURE__*/React.createElement("h2", {
    className: "section__title",
    id: "missions-title"
  }, "One love, expressed four ways"), /*#__PURE__*/React.createElement("p", {
    className: "section__intro"
  }, "Great Love begins as compassion and becomes action. These four missions are how that action reaches the world.")), /*#__PURE__*/React.createElement("div", {
    className: "mission-grid"
  }, MISSIONS.map(m => /*#__PURE__*/React.createElement("div", {
    className: "reveal",
    key: m.title
  }, /*#__PURE__*/React.createElement(MCard, {
    icon: m.icon,
    title: m.title,
    zh: m.zh
  }, m.text)))), /*#__PURE__*/React.createElement("p", {
    className: "missions__note reveal"
  }, "The four missions extend into eight footprints: international disaster relief, bone marrow donation, environmental protection and community volunteering.")));
}
window.Missions = Missions;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Missions.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundation-site/Story.jsx
try { (() => {
// Foundation site — founding story ("many drops make a river")
const {
  Stat: SStat
} = window.TzuChiDesignSystem_2f3041;
function Story() {
  return /*#__PURE__*/React.createElement("section", {
    className: "section story",
    id: "story",
    "aria-labelledby": "story-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap story__inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "story__text reveal"
  }, /*#__PURE__*/React.createElement("p", {
    className: "story__zh",
    lang: "zh-Hant"
  }, "\u6EF4\u6C34\u6210\u6CB3"), /*#__PURE__*/React.createElement("p", {
    className: "story__zh-en"
  }, "Drops of water form a river"), /*#__PURE__*/React.createElement("h2", {
    className: "story__title",
    id: "story-title"
  }, "Many drops make a river"), /*#__PURE__*/React.createElement("p", null, "In 1966, thirty homemakers each set aside fifty cents a day in a bamboo coin bank. That small, daily habit grew into a foundation that now serves people across the world."), /*#__PURE__*/React.createElement("p", null, "Great Love is not built in a single gift. It gathers, drop by drop, from ordinary people who choose to give what they can."), /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, /*#__PURE__*/React.createElement(SStat, {
    value: "1966",
    label: "Founded in Hualien"
  }), /*#__PURE__*/React.createElement(SStat, {
    value: "60 yrs",
    label: "Of Great Love"
  }), /*#__PURE__*/React.createElement(SStat, {
    value: "4 \xB7 8",
    label: "Missions & footprints"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "story__media reveal",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/bamboo-bank.svg",
    alt: ""
  }))));
}
window.Story = Story;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundation-site/Story.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Aphorism = __ds_scope.Aphorism;

__ds_ns.LotusMark = __ds_scope.LotusMark;

__ds_ns.MissionCard = __ds_scope.MissionCard;

__ds_ns.Roofline = __ds_scope.Roofline;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Tag = __ds_scope.Tag;

})();
