import type { GraphResponse } from './linggenApi';

/**
 * Helper: Build HTML for the graph webview and render a simple radial layout.
 * We keep this self-contained so we don't need extra bundles.
 */
export function getGraphWebviewHtml(initial: {
    graph: GraphResponse;
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

      let graph = initial.graph;
      let focusNodeId = initial.focusNodeId;

      const metaEl = document.getElementById('meta');
      metaEl.textContent = graph.nodes.length + ' nodes · ' + graph.edges.length + ' edges';

      const container = document.getElementById('graph');

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      container.appendChild(svg);

      function layout(nodes, edges, focusId) {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        const cx = width / 2;
        const cy = height / 2;

        const positions = {};

        if (!nodes.length) return { positions };

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

        return { positions };
      }

      function render() {
        svg.innerHTML = '';

        const { positions } = layout(graph.nodes, graph.edges, focusNodeId);

        // Draw edges
        graph.edges.forEach(edge => {
          const s = positions[edge.source];
          const t = positions[edge.target];
          if (!s || !t) return;

          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', String(s.x));
          line.setAttribute('y1', String(s.y));
          line.setAttribute('x2', String(t.x));
          line.setAttribute('y2', String(t.y));
          line.setAttribute('class', 'edge');
          svg.appendChild(line);
        });

        // Draw nodes
        graph.nodes.forEach(node => {
          const pos = positions[node.id];
          if (!pos) return;

          const g = document.createElementNS(svgNS, 'g');
          g.setAttribute('class', 'node' + (node.id === focusNodeId ? ' focus' : ''));
          g.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);

          const circle = document.createElementNS(svgNS, 'circle');
          const r = node.id === focusNodeId ? 11 : 7;
          const fill = node.id === focusNodeId ? '#f97316' : '#38bdf8';
          circle.setAttribute('r', String(r));
          circle.setAttribute('fill', fill);
          circle.setAttribute('stroke', 'rgba(15,23,42,0.9)');
          g.appendChild(circle);

          const label = document.createElementNS(svgNS, 'text');
          label.setAttribute('x', '0');
          label.setAttribute('y', String(-r - 6));
          label.setAttribute('text-anchor', 'middle');
          label.textContent = node.label;
          g.appendChild(label);

          svg.appendChild(g);
        });
      }

      window.addEventListener('resize', () => {
        render();
      });

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
        graph = msg.graph;
        focusNodeId = msg.focusNodeId;
        metaEl.textContent = graph.nodes.length + ' nodes · ' + graph.edges.length + ' edges';
        render();
      });
    })();
  </script>
</body>
</html>
`;
}

