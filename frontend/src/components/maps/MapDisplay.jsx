// src/components/maps/MapDisplay.jsx
import React, { useEffect, useRef } from 'react';
import { Box, Typography } // Typography might be used for fallback
  from '@mui/material';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// --- Helper function to draw an individual element ---
// This function should remain as it was from our previous successful version
const drawElement = (ctx, element, mapPixelWidth, mapPixelHeight) => {
  if (!element || !element.element_type || !element.element_data) {
    // console.warn("drawElement: Invalid element data provided", element); // Keep console logs minimal in production
    return;
  }

  const xPx = element.x_coord_percent * mapPixelWidth;
  const yPx = element.y_coord_percent * mapPixelHeight;

  const wrapText = (context, text, x, y, maxWidth, lineHeight, fontColor, bgColor) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Calculate background dimensions based on actual lines
    if (bgColor && maxWidth && lines.length > 0) {
      let actualMaxWidth = 0;
      lines.forEach(l => {
        actualMaxWidth = Math.max(actualMaxWidth, context.measureText(l).width);
      });
      const actualHeight = lines.length * lineHeight;

      context.save();
      context.fillStyle = bgColor;
      let bgX = x;
      let bgY = y;
      // Adjust based on textAlign and textBaseline for background
      if (context.textAlign === 'center') bgX -= actualMaxWidth / 2;
      else if (context.textAlign === 'right') bgX -= actualMaxWidth;
      if (context.textBaseline === 'middle') bgY -= actualHeight / 2;
      else if (context.textBaseline === 'bottom') bgY -= actualHeight;
      // For 'top' and 'alphabetic' with 'left' align, x,y is typically top-left of first line.

      context.fillRect(bgX - 2, bgY - 2, actualMaxWidth + 4, actualHeight + (lines.length > 1 ? 0 : 4)); // Padding
      context.restore();
    }

    context.fillStyle = fontColor || '#000000';
    lines.forEach((l, index) => {
      context.fillText(l.trim(), x, currentY + (index * lineHeight));
    });
  };

  switch (element.element_type) {
    case 'pin':
      ctx.save();
      const pinSize = element.element_data.size || 5;
      ctx.fillStyle = element.element_data.color || 'red';
      ctx.beginPath();
      ctx.arc(xPx, yPx, pinSize, 0, 2 * Math.PI);
      ctx.fill();
      if (element.element_data.label) { // Use element_data.label for pin's on-map text
        ctx.font = element.element_data.labelFont || '10px sans-serif';
        ctx.fillStyle = element.element_data.labelColor || ctx.fillStyle; // Use pin color if labelColor not set
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // Place label text just above the pin center
        ctx.fillText(element.element_data.label, xPx, yPx - pinSize - 2);
      }
      ctx.restore();
      break;
    case 'text':
      ctx.save();
      const textContent = element.element_data.content || '';
      const fontSize = element.element_data.fontSize || '16px';
      const fontFamily = element.element_data.fontFamily || 'sans-serif';
      const textColor = element.element_data.textColor || '#000000';
      const textBgColor = element.element_data.backgroundColor;

      ctx.font = `${element.element_data.fontStyle || ''} ${element.element_data.fontWeight || ''} ${fontSize} ${fontFamily}`.trim();
      ctx.textAlign = element.element_data.textAlign || 'left';
      ctx.textBaseline = element.element_data.textBaseline || 'top';

      const textMaxWidth = element.width_percent ? element.width_percent * mapPixelWidth : null;
      const lineHeight = parseFloat(fontSize) * 1.2;

      if (textMaxWidth && textContent.includes(' ')) {
        wrapText(ctx, textContent, xPx, yPx, textMaxWidth, lineHeight, textColor, textBgColor);
      } else {
        if (textBgColor) {
          const textMetrics = ctx.measureText(textContent);
          const textW = textMetrics.width;
          const textH = parseFloat(fontSize) * 1.2;
          let bgX = xPx; let bgY = yPx;
          if (ctx.textAlign === 'center') bgX -= textW / 2; else if (ctx.textAlign === 'right') bgX -= textW;
          if (ctx.textBaseline === 'middle') bgY -= textH / 2; else if (ctx.textBaseline === 'bottom') bgY -= textH;
          ctx.fillStyle = textBgColor;
          ctx.fillRect(bgX - 2, bgY - 2, textW + 4, textH + 4);
        }
        ctx.fillStyle = textColor;
        ctx.fillText(textContent, xPx, yPx);
      }
      ctx.restore();
      break;
    case 'area':
      ctx.save();
      const areaWidthPx = element.width_percent ? element.width_percent * mapPixelWidth : 0;
      const areaHeightPx = element.height_percent ? element.height_percent * mapPixelHeight : 0;
      if (areaWidthPx > 0 && areaHeightPx > 0) {
        if (element.element_data.fillColor) {
          ctx.fillStyle = element.element_data.fillColor;
          ctx.fillRect(xPx, yPx, areaWidthPx, areaHeightPx);
        }
        if (element.element_data.strokeColor && element.element_data.strokeWidth > 0) {
          ctx.strokeStyle = element.element_data.strokeColor;
          ctx.lineWidth = element.element_data.strokeWidth;
          ctx.strokeRect(xPx, yPx, areaWidthPx, areaHeightPx);
        }
      }
      ctx.restore();
      break;
    default:
    // console.warn("MapDisplay: Unknown element type to draw:", element.element_type);
  }
};


const MapDisplay = ({
  mapImageUrl,
  naturalWidth,
  naturalHeight,
  gridEnabled,
  gridSizePixels,
  fogDataJsonString,
  elements = [],
  transformWrapperRef,
  isPanDisabled = false,
  isDMView = false, // NEW PROP: Default to player view (opaque fog)
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    // console.log("[MapDisplay] Rendering. DM View:", isDMView);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!mapImageUrl || !naturalWidth || !naturalHeight) {
      if (canvas.width > 0 && canvas.height > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
    }

    const img = new Image();
    img.onload = () => {
      // --- STEP 0: Clear canvas completely ---
      ctx.clearRect(0, 0, naturalWidth, naturalHeight);

      // --- STEP 1: Draw the base map image ---
      ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);

      // --- STEP 2: Helper function to draw grid ---
      const drawGrid = () => {
        if (gridEnabled && gridSizePixels > 0 && naturalWidth > 0 && naturalHeight > 0) {
          const effectiveGridColor = 'rgba(0,0,0,0.3)';
          ctx.strokeStyle = effectiveGridColor;
          ctx.lineWidth = 0.5;
          for (let x = 0; x < naturalWidth; x += gridSizePixels) {
            ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, naturalHeight); ctx.stroke();
          }
          for (let y = 0; y < naturalHeight; y += gridSizePixels) {
            ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(naturalWidth, y + 0.5); ctx.stroke();
          }
        }
      };
      drawGrid(); // Draw grid on top of the map

      // --- STEP 3: Draw ALL elements on top of map & grid ---
      if (Array.isArray(elements)) {
        elements.forEach(element => {
          // For DM view, show all. For Player view, elements are pre-filtered,
          // but an additional check for `is_visible_to_players` here is fine as a safeguard.
          // The `element._isSelectedHack` is for MapEditorPage to potentially highlight.
          if (isDMView || element.is_visible_to_players !== false || element._isSelectedHack) {
            drawElement(ctx, element, naturalWidth, naturalHeight);
          }
        });
      }

      // --- STEP 4: Draw the full fog layer ---
      if (isDMView) {
        ctx.fillStyle = "rgba(40, 40, 40, 0.75)"; // DM's semi-transparent fog
      } else {
        ctx.fillStyle = "rgb(40, 40, 40)";      // Player's opaque fog (solid dark grey)
      }
      ctx.fillRect(0, 0, naturalWidth, naturalHeight);


      // --- STEP 5: For each revealed area, "clear" fog by redrawing map, grid, and elements ---
      let revealedAreas = [];
      try {
        if (fogDataJsonString) {
          revealedAreas = JSON.parse(fogDataJsonString);
        }
      } catch (e) {
        console.error("MapDisplay: Error parsing fog_data_json_string:", e, fogDataJsonString);
      }

      if (Array.isArray(revealedAreas)) {
        revealedAreas.forEach(rect => {
          if (rect && typeof rect.x === 'number' && typeof rect.y === 'number' &&
            typeof rect.width === 'number' && typeof rect.height === 'number') {

            const xPx = rect.x * naturalWidth;
            const yPx = rect.y * naturalHeight;
            const wPx = rect.width * naturalWidth;
            const hPx = rect.height * naturalHeight;

            if (wPx > 0 && hPx > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(xPx, yPx, wPx, hPx);
              ctx.clip();

              ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
              drawGrid();

              if (Array.isArray(elements)) {
                elements.forEach(element => {
                  if (isDMView || element.is_visible_to_players !== false || element._isSelectedHack) {
                    drawElement(ctx, element, naturalWidth, naturalHeight);
                  }
                });
              }
              ctx.restore();
            }
          }
        });
      }
    };
    img.onerror = () => {
      console.error("MapDisplay: Failed to load image - ", mapImageUrl);
      ctx.clearRect(0, 0, naturalWidth, naturalHeight); // Clear canvas on error
    };

    if (img.src !== mapImageUrl) {
      img.src = mapImageUrl;
    } else if (img.complete && canvas.width === naturalWidth && canvas.height === naturalHeight) {
      img.onload();
    }

  }, [mapImageUrl, naturalWidth, naturalHeight, gridEnabled, gridSizePixels, fogDataJsonString, elements, isDMView]); // Added isDMView

  if (!mapImageUrl || !naturalWidth || !naturalHeight) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'grey.800' }}>
        <Typography variant="caption" color="text.secondary">
          {mapImageUrl ? "Loading map dimensions..." : "No map image selected or available."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'grey.900',
        '& .react-transform-wrapper': { backgroundColor: 'transparent !important' },
        '& .react-transform-component': { backgroundColor: 'transparent !important' },
      }}
    >
      <TransformWrapper
        ref={transformWrapperRef}
        initialScale={1} minScale={0.05} maxScale={15} limitToBounds={true} centerOnInit={true}
        doubleClick={{ disabled: true }} wheel={{ step: 0.1, smoothStep: 0.05, disabled: isPanDisabled }}
        panning={{ disabled: isPanDisabled, velocityDisabled: true }} pinch={{ disabled: isPanDisabled }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: `${naturalWidth}px`, height: `${naturalHeight}px` }}
        >
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </TransformComponent>
      </TransformWrapper>
    </Box>
  );
};

export default MapDisplay;
