(function () {
  "use strict";

  const AK = window.ASK_KRISHNA;
  const CARD_WIDTH = 1080;

  AK.passageFileName = function (entry) {
    const first = entry.verses[0].id;
    const last = entry.verses[entry.verses.length - 1].id;
    return `ask-krishna-${first}-${last}.png`;
  };

  AK.colors = function () {
    const styles = getComputedStyle(document.documentElement);
    return {
      bg: styles.getPropertyValue("--bg").trim(),
      surface: styles.getPropertyValue("--surface").trim(),
      text: styles.getPropertyValue("--text").trim(),
      muted: styles.getPropertyValue("--muted").trim(),
      subtle: styles.getPropertyValue("--subtle").trim(),
    };
  };

  AK.downloadCanvas = function (canvas, filename) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(true);
      }, "image/png");
    });
  };

  AK.cardCanvas = function (entry, translations) {
    const palette = AK.colors();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const plan = AK.cardPlan(ctx, entry, 0, translations);
    AK.sizeCanvas(canvas, ctx, CARD_WIDTH, plan.height);
    AK.drawCard(ctx, plan, palette);
    return canvas;
  };

  AK.sizeCanvas = function (canvas, ctx, width, height) {
    const scale = Math.min(window.devicePixelRatio || 1, height > 7000 ? 1 : 2);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(scale, scale);
  };

  AK.cardPlan = function (ctx, entry, offsetY, translations) {
    const padding = 74;
    const width = CARD_WIDTH;
    const max = width - padding * 2;
    const rows = [
      AK.canvasRow(ctx, "ref", AK.ref(entry.verses), max),
      { gap: 48 },
      ...entry.verses.map((verse) => AK.canvasRow(ctx, "sanskrit", verse.sanskrit, max, verse.id === entry.mainId)),
    ];
    if (translations) {
      rows.push({ divider: true, gap: 36 });
      entry.verses.forEach((verse) => {
        rows.push(AK.canvasRow(ctx, "translation", translations[verse.id], max, verse.id === entry.mainId));
      });
    }
    const bodyHeight = rows.reduce((sum, item) => sum + (item.height || 0) + (item.gap || 22), 0);
    return { entry, offsetY, padding, rows, width, height: Math.ceil(bodyHeight + padding * 2 - 22) };
  };

  AK.canvasRow = function (ctx, kind, value, max, main = false) {
    const style = AK.canvasRowStyle(kind);
    ctx.font = style.font;
    const lines = AK.wrapText(ctx, value, max);
    const inset = main ? 24 : 0;
    return { kind, lines, main, ...style, height: lines.length * style.lineHeight + inset * 2 };
  };

  AK.canvasRowStyle = function (kind) {
    if (kind === "ref") return { font: AK.canvasFont(24), lineHeight: 34, color: "muted" };
    if (kind === "sanskrit") return { font: AK.canvasFont(34), lineHeight: 58, color: "muted" };
    return { font: AK.canvasFont(43), lineHeight: 66, color: "text" };
  };

  AK.canvasFont = function (size, weight = "400") {
    return `${weight} ${size}px Georgia, "Noto Serif Devanagari", "Nirmala UI", serif`;
  };

  AK.wrapText = function (ctx, value, max) {
    return String(value || "").split("\n").flatMap((part) => {
      const segments = part.match(/\S+\s*/g);
      if (!segments) return [""];
      return segments.reduce((lines, segment) => {
        const last = lines[lines.length - 1] || "";
        const next = last + segment;
        if (!last || ctx.measureText(next.trimEnd()).width <= max) lines[lines.length - 1] = next;
        else lines.push(segment);
        return lines;
      }, [""]).map((entry) => entry.trimEnd());
    });
  };

  AK.drawCard = function (ctx, plan, palette) {
    ctx.beginPath();
    ctx.roundRect(0.5, plan.offsetY + 0.5, plan.width - 1, plan.height - 1, 18);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.subtle;
    ctx.lineWidth = 1;
    ctx.stroke();
    let y = plan.offsetY + plan.padding;
    plan.rows.forEach((item) => {
      if (item.divider) {
        AK.strokeLine(ctx, palette.subtle, plan.padding, y + 0.5, plan.width - plan.padding, y + 0.5);
        y += item.gap;
        return;
      }
      if (item.gap) {
        y += item.gap;
        return;
      }
      AK.drawCanvasRow(ctx, item, plan, y, palette);
      y += item.height + 22;
    });
  };

  AK.drawCanvasRow = function (ctx, item, plan, y, palette) {
    const max = plan.width - plan.padding * 2;
    const color = palette[item.color];
    const x = plan.width / 2;
    let textY = y;
    ctx.font = item.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    if (item.main) {
      AK.strokeLine(ctx, palette.subtle, plan.padding, y + 0.5, plan.width - plan.padding, y + 0.5);
      AK.strokeLine(ctx, palette.subtle, plan.padding, y + item.height + 0.5, plan.width - plan.padding, y + item.height + 0.5);
      textY += 24;
    }
    item.lines.forEach((part) => {
      ctx.fillText(part, x, textY, max);
      textY += item.lineHeight;
    });
  };

  AK.strokeLine = function (ctx, color, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  AK.download = async function (entry, translations) {
    await document.fonts?.ready;
    return AK.downloadCanvas(AK.cardCanvas(entry, translations), AK.passageFileName(entry));
  };
})();
