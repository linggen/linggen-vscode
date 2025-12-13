import type { GraphResponse } from './linggenApi';

/**
 * Helper: Build HTML for the graph webview and render a simple radial layout.
 * We keep this self-contained so we don't need extra bundles.
 */
export function getGraphWebviewHtml(initial: {
    graph: GraphResponse;
    fullGraph?: GraphResponse | null;
    focusNodeId: string | null;
}): string {
    const payload = JSON.stringify(initial);
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linggen Graph</title>
  <style>
    :root {
      color-scheme: dark;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #020617;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e5e7eb;
    }
    #toolbar {
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(15, 23, 42, 0.86);
      border-radius: 6px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      font-size: 12px;
      z-index: 10;
      backdrop-filter: blur(8px);
    }
    #toolbar .title {
      font-weight: 600;
      color: #e5e7eb;
    }
    #toolbar .meta {
      color: #9ca3af;
      font-size: 11px;
    }
    #graph {
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      background: radial-gradient(circle at top, #0f172a 0, #020617 60%);
    }
    .node {
      cursor: pointer;
      transition: transform 0.15s ease-out;
    }
    .node circle {
      stroke-width: 1.5;
    }
    .node text {
      font-size: 11px;
      fill: #e5e7eb;
      text-shadow: 0 0 4px #020617;
    }
    .node.focus circle {
      stroke: #f97316;
      stroke-width: 2.5;
    }
    .node.focus text {
      fill: #fbbf24;
      font-weight: 600;
    }
    .edge {
      stroke: rgba(148, 163, 184, 0.5);
      stroke-width: 1;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <div class="title">Linggen Graph View</div>
    <div class="meta" id="meta"></div>
    <button id="toggle-mode-btn" title="Show all nodes in this graph" style="
      margin-left: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      cursor: pointer;
      font-size: 11px;
    ">All nodes</button>
    <button id="open-linggen-btn" title="Open Linggen app" style="
      margin-left: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      cursor: pointer;
      font-size: 11px;
    ">Open Linggen</button>
    <button id="refresh-btn" title="Refresh graph" style="
      margin-left: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      cursor: pointer;
      font-size: 11px;
    ">Refresh</button>
  </div>
  <div id="graph"></div>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();

      const initial = ${payload};

      let focusedGraph = initial.graph;
      let fullGraph = initial.fullGraph || initial.graph;
      let focusNodeId = initial.focusNodeId;
      let mode = 'focus'; // 'focus' | 'all'

      const metaEl = document.getElementById('meta');

      const container = document.getElementById('graph');

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      container.appendChild(svg);

      // Viewport group that we pan/zoom via transform
      const viewport = document.createElementNS(svgNS, 'g');
      svg.appendChild(viewport);

      let zoom = 1;
      let panX = 0;
      let panY = 0;
      let isPanning = false;
      let lastPanX = 0;
      let lastPanY = 0;

      function currentGraph() {
        return mode === 'all' && fullGraph ? fullGraph : focusedGraph;
      }

      function buildFocusSubgraph(graph, centerId) {
        if (!graph || !centerId) return graph;
        const neighborIds = new Set();
        neighborIds.add(centerId);

        for (const e of graph.edges || []) {
          if (e.source === centerId) neighborIds.add(e.target);
          else if (e.target === centerId) neighborIds.add(e.source);
        }

        const nodes = (graph.nodes || []).filter(n => neighborIds.has(n.id));
        const edges = (graph.edges || []).filter(
          e => neighborIds.has(e.source) && neighborIds.has(e.target)
        );

        return { ...graph, nodes, edges };
      }

      function updateMeta() {
        const g = currentGraph();
        const suffix = mode === 'all' ? ' (all nodes)' : '';
        metaEl.textContent = g.nodes.length + ' nodes · ' + g.edges.length + ' edges' + suffix;
      }

      function updateViewportTransform() {
        viewport.setAttribute('transform', \`translate(\${panX}, \${panY}) scale(\${zoom})\`);

        // Show labels only when zoomed in, but always show focus label
        const showLabels = zoom >= 0.9 || currentGraph().nodes.length <= 40;
        const texts = svg.querySelectorAll('.node text');
        texts.forEach((el) => {
          const parent = el.parentNode;
          const isFocus =
            !!parent &&
            parent.classList &&
            parent.classList.contains('focus');
          el.style.display = showLabels || isFocus ? 'block' : 'none';
        });
      }

      function layout(nodes, edges, focusId) {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        const cx = width / 2;
        const cy = height / 2;

        const positions = {};

        if (!nodes.length) return { positions };

        // Focus mode: keep current file in the center and neighbors around it.
        if (mode === 'focus') {
          const focusIndex = focusId
            ? nodes.findIndex(n => n.id === focusId)
            : 0;

          const radius = Math.min(width, height) * 0.32;

          nodes.forEach((node, index) => {
            if (index === focusIndex) {
              positions[node.id] = { x: cx, y: cy };
              return;
            }
            const k = index < focusIndex ? index : index - 1;
            const angle = (2 * Math.PI * k) / Math.max(1, nodes.length - 1);
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            positions[node.id] = { x, y };
          });
        } else {
          // "All nodes" mode: lay out nodes in multiple concentric rings so
          // labels don't all sit on top of each other.
          const maxPerRing = 32;
          const baseRadius = Math.min(width, height) * 0.18;
          const ringGap = Math.min(width, height) * 0.12;

          nodes.forEach((node, index) => {
            const ring = Math.floor(index / maxPerRing);
            const inRingIndex = index % maxPerRing;
            const nodesInRing = Math.min(
              maxPerRing,
              nodes.length - ring * maxPerRing
            );
            const angle =
              (2 * Math.PI * inRingIndex) / Math.max(1, nodesInRing);
            const radius = baseRadius + ring * ringGap;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            positions[node.id] = { x, y };
          });
        }

        return { positions };
      }

      function render() {
        viewport.innerHTML = '';

        const g = currentGraph();
        const { positions } = layout(g.nodes, g.edges, focusNodeId);

        // Draw edges
        g.edges.forEach(edge => {
          const s = positions[edge.source];
          const t = positions[edge.target];
          if (!s || !t) return;

          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', String(s.x));
          line.setAttribute('y1', String(s.y));
          line.setAttribute('x2', String(t.x));
          line.setAttribute('y2', String(t.y));
          line.setAttribute('class', 'edge');
          viewport.appendChild(line);
        });

        // Draw nodes
        g.nodes.forEach(node => {
          const pos = positions[node.id];
          if (!pos) return;

          const ng = document.createElementNS(svgNS, 'g');
          ng.setAttribute('class', 'node' + (node.id === focusNodeId ? ' focus' : ''));
          ng.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);

          // Click: focus this node and show its 1-hop neighbors.
          // Stop propagation so it doesn't trigger panning.
          ng.addEventListener('mousedown', (event) => event.stopPropagation());
          ng.addEventListener('click', (event) => {
            event.stopPropagation();

            // If we're in "all" mode, clicking a node switches to focus mode.
            if (mode === 'all') {
              mode = 'focus';
              updateToggleLabel();
            }

            focusNodeId = node.id;
            focusedGraph = buildFocusSubgraph(fullGraph, focusNodeId);
            updateMeta();
            render();
          });

          const circle = document.createElementNS(svgNS, 'circle');
          const r = node.id === focusNodeId ? 11 : 7;
          const fill = node.id === focusNodeId ? '#f97316' : '#38bdf8';
          circle.setAttribute('r', String(r));
          circle.setAttribute('fill', fill);
          circle.setAttribute('stroke', 'rgba(15,23,42,0.9)');
          ng.appendChild(circle);

          const label = document.createElementNS(svgNS, 'text');
          label.setAttribute('x', '0');
          label.setAttribute('y', String(-r - 6));
          label.setAttribute('text-anchor', 'middle');
          label.textContent = node.label;
          ng.appendChild(label);

          viewport.appendChild(ng);
        });

        updateViewportTransform();
      }

      window.addEventListener('resize', () => {
        render();
      });

      // Zoom with mouse wheel
      svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const factor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(5, Math.max(0.2, zoom * factor));
        const scaleChange = newZoom / zoom;
        zoom = newZoom;

        // Zoom around mouse position
        panX = mouseX - scaleChange * (mouseX - panX);
        panY = mouseY - scaleChange * (mouseY - panY);

        updateViewportTransform();
      }, { passive: false });

      // Pan with mouse drag
      svg.addEventListener('mousedown', (event) => {
        isPanning = true;
        lastPanX = event.clientX;
        lastPanY = event.clientY;
      });
      window.addEventListener('mousemove', (event) => {
        if (!isPanning) return;
        const dx = event.clientX - lastPanX;
        const dy = event.clientY - lastPanY;
        lastPanX = event.clientX;
        lastPanY = event.clientY;
        panX += dx;
        panY += dy;
        updateViewportTransform();
      });
      window.addEventListener('mouseup', () => {
        isPanning = false;
      });
      svg.addEventListener('mouseleave', () => {
        isPanning = false;
      });

      // Handle mode toggle (focus vs all nodes)
      const toggleBtn = document.getElementById('toggle-mode-btn');
      let updateToggleLabel = function() {};
      if (toggleBtn) {
        updateToggleLabel = function updateToggleLabel() {
          if (mode === 'all') {
            toggleBtn.textContent = 'Focus';
            toggleBtn.title = 'Show only nodes related to the current file';
          } else {
            toggleBtn.textContent = 'All nodes';
            toggleBtn.title = 'Show all nodes in this graph';
          }
        };
        toggleBtn.addEventListener('click', () => {
          mode = mode === 'all' ? 'focus' : 'all';
          updateToggleLabel();
          updateMeta();
          render();
        });
        updateToggleLabel();
      }

      updateMeta();
      render();

      // Handle refresh button
      const refreshBtn = document.getElementById('refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'refresh' });
        });
      }

      // Handle "Open Linggen" button
      const openBtn = document.getElementById('open-linggen-btn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'openLinggen' });
        });
      }

      // Handle messages from the extension with new graph data
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || msg.type !== 'graphData') return;
        focusedGraph = msg.graph;
        if (msg.fullGraph) {
          fullGraph = msg.fullGraph;
        }
        focusNodeId = msg.focusNodeId;
        updateMeta();
        render();
      });
    })();
  </script>
</body>
</html>
`;
}

