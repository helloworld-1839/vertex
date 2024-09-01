import './style.css'


interface Shape {
    color: string;
    isPreDrawn: boolean;
    vertices: number[];

    completed: boolean;
}
interface Vertex {
    coordinates: number[];
    shapes: string[];

    selected: 0 | 1 | 2;
}
interface Puzzle {
    date: string;
    displayDate: string;
    id: string;
    palette: string[];
    puzzleConstructor: string;
    theme: string;
    shapes: Shape[];
    vertices: { [key: string]: Vertex };
}
type Stroke = [Vertex, Vertex];

let puzzles: { path: string, url: string}[] = []; 
async function fetchPuzzles() {
    const select = <HTMLElement>document.getElementById('select');
    const response = await fetch('https://api.github.com/repos/Q726kbXuN/vertex/git/trees/master?recursive=1'); // THANK YOU
    const data = await response.json();
    puzzles = data.tree.filter((file: { path: string }) => file.path.startsWith('data/'));
    puzzles.reverse().forEach((puzzle: { path: string, url: string})  => {
        const path = puzzle.path.split('/')[3];
        if (path) {
            const year = parseInt(path.split('-')[0]);
            const option = document.createElement('option');
            option.value = puzzle.url;
            option.innerText = path.split('.')[0];
            select.children[2*(2024-year) + 2].append(option);
        }
    });
}
fetchPuzzles();
function fetchPuzzle() {
    return new Promise<Puzzle>(async (resolve, reject) => {
        document.getElementById('selectpuzzle')?.addEventListener('click', async () => {
            const url = (<HTMLSelectElement>document.getElementById('select')).value;
            if (url) {
                let response = await fetch(url);
                let data = await response.json();
                resolve(JSON.parse(atob(data.content))); // i dont even know
            }
        });

    });
}
const puzzle: Puzzle = await fetchPuzzle();
let completedStrokes: Stroke[] = [];
let completed = false;
(<HTMLDivElement>document.getElementById('overlay')).style.display = 'none';

const fillCanvas = <HTMLCanvasElement>document.getElementById('fill');
const strokeCanvas = <HTMLCanvasElement>document.getElementById('stroke');
const pointsCanvas = <HTMLCanvasElement>document.getElementById('points');
const cursorCanvas = <HTMLCanvasElement>document.getElementById('cursor');
const uiCanvas = <HTMLCanvasElement>document.getElementById('uicanvas');

const fillCtx = <CanvasRenderingContext2D>fillCanvas.getContext('2d');
const strokeCtx = <CanvasRenderingContext2D>strokeCanvas.getContext('2d');
const pointsCtx = <CanvasRenderingContext2D>pointsCanvas.getContext('2d');
const cursorCtx = <CanvasRenderingContext2D>cursorCanvas.getContext('2d');
const uiCtx = <CanvasRenderingContext2D>uiCanvas.getContext('2d');

let extents = getExtents();
let xShift = -extents.minX + document.documentElement.clientWidth / 2 - (extents.maxX - extents.minX) / 2;
let yShift = -extents.minY + document.documentElement.clientHeight / 2 - (extents.maxY - extents.minY) / 2;
let scale = 1;

function setCanvasSizes() {
    fillCanvas.height = document.documentElement.clientHeight;
    fillCanvas.width = document.documentElement.clientWidth;
    strokeCanvas.height = document.documentElement.clientHeight;
    strokeCanvas.width = document.documentElement.clientWidth;
    pointsCanvas.height = document.documentElement.clientHeight;
    pointsCanvas.width = document.documentElement.clientWidth;
    cursorCanvas.height = document.documentElement.clientHeight;
    cursorCanvas.width = document.documentElement.clientWidth;
    uiCanvas.height = document.documentElement.clientHeight;
    uiCanvas.width = document.documentElement.clientWidth;
}
setCanvasSizes();
window.visualViewport?.addEventListener('resize', () => {
    setCanvasSizes();
    render();
});

function getExtents() {
    const minX = Math.min(...Object.keys(puzzle.vertices).map(key => puzzle.vertices[key].coordinates[0]));
    const minY = Math.min(...Object.keys(puzzle.vertices).map(key => puzzle.vertices[key].coordinates[1]));
    const maxX = Math.max(...Object.keys(puzzle.vertices).map(key => puzzle.vertices[key].coordinates[0]));
    const maxY = Math.max(...Object.keys(puzzle.vertices).map(key => puzzle.vertices[key].coordinates[1]));
    return { minX, minY, maxX, maxY };
}
function getStrokesAtPoint(vertex: Vertex | string): Stroke[] {
    if (typeof vertex === 'string') {
        vertex = puzzle.vertices[vertex];
    }
    const strokes: Stroke[] = [];
    for (let shapeIdx of vertex.shapes) {
        for (let shapeVertex of puzzle.shapes[parseInt(shapeIdx)].vertices) {
            if (puzzle.vertices[shapeVertex] === vertex) {
                continue;
            }
            const stroke: Stroke = [vertex, puzzle.vertices[shapeVertex]];
            if (strokes.find(s => s[0] === stroke[0] && s[1] === stroke[1] || s[0] === stroke[1] && s[1] === stroke[0])) {
                continue;
            }
            strokes.push(stroke);
        }
    }
    return strokes;
}
function getCompletedStrokesAtPoint(vertex: Vertex | string): Stroke[] {
    if (typeof vertex === 'string') {
        vertex = puzzle.vertices[vertex];
    }
    const strokes: Stroke[] = completedStrokes.filter(stroke => stroke[0] === vertex || stroke[1] === vertex);
    return strokes;
}

function renderStrokes() {
    strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    if (completed) return;
    for (const stroke of completedStrokes) {
        strokeCtx.strokeStyle = "black";
        strokeCtx.lineWidth = 1;
        strokeCtx.beginPath();
        strokeCtx.moveTo(scale * (stroke[0].coordinates[0]) + xShift, scale * (stroke[0].coordinates[1]) + yShift);
        strokeCtx.lineTo(scale * (stroke[1].coordinates[0]) + xShift, scale * (stroke[1].coordinates[1]) + yShift);
        strokeCtx.closePath();
        strokeCtx.stroke();
    }
}
function renderShapes() {
    fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
    let allCompleted = true;
    for (const shape of puzzle.shapes) {
        if (isStrokeCompleted([puzzle.vertices[shape.vertices[0]], puzzle.vertices[shape.vertices[1]]]) &&
            isStrokeCompleted([puzzle.vertices[shape.vertices[1]], puzzle.vertices[shape.vertices[2]]]) &&
            isStrokeCompleted([puzzle.vertices[shape.vertices[2]], puzzle.vertices[shape.vertices[0]]])) {
            shape.completed = true;
        }
        else if (completed) {
            shape.completed = true;
        }
        else {
            allCompleted = false;
            shape.completed = false;
        }
        if (shape.isPreDrawn) {
            completedStrokes.push([puzzle.vertices[shape.vertices[0]], puzzle.vertices[shape.vertices[1]]]);
            completedStrokes.push([puzzle.vertices[shape.vertices[1]], puzzle.vertices[shape.vertices[2]]]);
            completedStrokes.push([puzzle.vertices[shape.vertices[2]], puzzle.vertices[shape.vertices[0]]]);
            shape.completed = true;
            shape.isPreDrawn = false;
            renderStrokes();
            renderPoints();
        }
        if (shape.completed) {
            fillCtx.fillStyle = puzzle.palette[parseInt(shape.color)];
            fillCtx.beginPath();
            fillCtx.moveTo(scale * (puzzle.vertices[shape.vertices[0]].coordinates[0]) + xShift, scale * (puzzle.vertices[shape.vertices[0]].coordinates[1]) + yShift);
            fillCtx.lineTo(scale * (puzzle.vertices[shape.vertices[1]].coordinates[0]) + xShift, scale * (puzzle.vertices[shape.vertices[1]].coordinates[1]) + yShift);
            fillCtx.lineTo(scale * (puzzle.vertices[shape.vertices[2]].coordinates[0]) + xShift, scale * (puzzle.vertices[shape.vertices[2]].coordinates[1]) + yShift);
            fillCtx.closePath();
            fillCtx.fill();
        }

    }
    if (allCompleted) {
        completed = true;
        renderStrokes();
        renderPoints();
        renderCursor();
        renderUI();
    };
}
function getPointSize(key: string) {
    const number = getStrokesAtPoint(key).length - getCompletedStrokesAtPoint(key).length;
    return number < 4 ? 14 : number < 7 ? 18 : 22
}
function renderPoints() {
    pointsCtx.clearRect(0, 0, pointsCanvas.width, pointsCanvas.height);
    if (completed) return;
    for (const key in puzzle.vertices) {
        const vertex = puzzle.vertices[key];
        const strokes = getStrokesAtPoint(key).length - getCompletedStrokesAtPoint(key).length;

        if (strokes === 0 && !vertex.shapes.find(shape => !puzzle.shapes[parseInt(shape)].completed)) continue;

        const size = getPointSize(key);


        pointsCtx.strokeStyle = vertex.selected === 2 ? "#e7ad34" : "black";

        pointsCtx.lineWidth = 1;
        pointsCtx.setLineDash([1, 1]);
        pointsCtx.beginPath();
        pointsCtx.arc(scale * (vertex.coordinates[0]) + xShift, scale * (vertex.coordinates[1]) + yShift, 1.5 * size, 0, 2 * Math.PI);
        pointsCtx.closePath();
        if (vertex.selected) {
            pointsCtx.fillStyle = vertex.selected === 2 ? "#e7ad3433" : "rgba(0, 0, 0, 0.2)";
            pointsCtx.fill();
        }
        pointsCtx.stroke();

        pointsCtx.fillStyle = vertex.selected === 2 ? "#e7ad34" : vertex.selected === 1 ? "black" : "white";
        pointsCtx.lineWidth = 1;
        pointsCtx.setLineDash([]);
        pointsCtx.beginPath();
        pointsCtx.arc(scale * (vertex.coordinates[0]) + xShift, scale * (vertex.coordinates[1]) + yShift, size, 0, 2 * Math.PI);
        pointsCtx.closePath();
        pointsCtx.fill();
        pointsCtx.stroke();

        pointsCtx.font = "15px Arial";
        pointsCtx.textAlign = "center";
        pointsCtx.textBaseline = "middle";
        pointsCtx.fillStyle = vertex.selected === 1 ? "white" : "black";
        pointsCtx.fillText(strokes.toString(), scale * (vertex.coordinates[0]) + xShift, scale * (vertex.coordinates[1]) + yShift)
    }
}
function createStroke(vertex1: Vertex, vertex2: Vertex): boolean {
    console.log('stroke completed');
    // LINES CANNOT CROSS!!!!
    const ax = vertex1.coordinates[0];
    const ay = vertex1.coordinates[1];
    const bx = vertex2.coordinates[0];
    const by = vertex2.coordinates[1];
    for (let stroke of completedStrokes) {
        const cx = stroke[0].coordinates[0];
        const cy = stroke[0].coordinates[1];
        const dx = stroke[1].coordinates[0];
        const dy = stroke[1].coordinates[1];
        const den = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
        if (den === 0) {
            continue;
        }
        const ua = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / den;
        const ub = ((bx - ax) * (ay - cy) - (by - ay) * (ax - cx)) / den;
        if (ua > 0 && ua < 1 && ub > 0 && ub < 1) {
            console.log('crossing', vertex1, vertex2, stroke);
            return false;
        }
    }

    // DOES THE POINT HAVE ENOUGH REMAINING STROKES???
    if (getStrokesAtPoint(vertex1).length - getCompletedStrokesAtPoint(vertex1).length < 1 || getStrokesAtPoint(vertex2).length - getCompletedStrokesAtPoint(vertex2).length < 1) {
        console.log('not enough strokes');
        return false;
    }
    const stroke: Stroke = [vertex1, vertex2];

    if (isStrokeCompleted([vertex1, vertex2])) {
        console.log('stroke already exists');
        return false;
    };
    completedStrokes.push(stroke);

    render();
    return true;
}

function isStrokeCompleted(stroke: Stroke) {
    return (completedStrokes.find(s => s[0] === stroke[0] && s[1] === stroke[1] || s[0] === stroke[1] && s[1] === stroke[0]));
}


let clicked: Vertex | null;
let selected: Vertex | null;
let mouseDown = false;
let mouse = { x: 0, y: 0 };
window.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keyup', event => {
    if (event.key === 'Backspace' && completedStrokes.length > 0) {
        completedStrokes.pop();
        render();
    }
});
window.addEventListener('wheel', event => {
    if (event.deltaY < 0 && scale < 6) {
        const x = ((mouse.x - xShift) / scale); // mouse x in puzzle coordinates
        const newX = ((scale + 0.2) * x + xShift); // screen x of same puzzle coordinates in new scale
        const maxX = (scale * extents.maxX + xShift);
        const minX = (scale * extents.minX + xShift);
        xShift -= Math.max(Math.min(newX, maxX), minX) - mouse.x; // difference between new screen x (which cannot exceed min/max of puzzle) and mouse x

        const y = ((mouse.y - yShift) / scale);
        const newY = ((scale + 0.2) * y + yShift);
        const maxY = (scale * extents.maxY + yShift);
        const minY = (scale * extents.minY + yShift);
        yShift -= Math.max(Math.min(newY, maxY), minY) - mouse.y;

        scale += 0.2;
    }
    if (event.deltaY > 0 && scale > 0.4) {
        const x = ((mouse.x - xShift) / scale); // mouse x in puzzle coordinates
        const newX = ((scale - 0.2) * x + xShift); // screen x of same puzzle coordinates in new scale
        const maxX = (scale * extents.maxX + xShift);
        const minX = (scale * extents.minX + xShift);
        xShift -= Math.max(Math.min(newX, maxX), minX) - mouse.x; // difference between new screen x (which cannot exceed min/max of puzzle) and mouse x

        const y = ((mouse.y - yShift) / scale);
        const newY = ((scale - 0.2) * y + yShift);
        const maxY = (scale * extents.maxY + yShift);
        const minY = (scale * extents.minY + yShift);
        yShift -= Math.max(Math.min(newY, maxY), minY) - mouse.y;


        scale -= 0.2;
    }

    render();
})
interface Vector { x: number, y: number };
function sqr(x: number) { return x * x }
function dist2(v: Vector, w: Vector) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p: Vector, v: Vector, w: Vector) {
    var l2 = dist2(v, w);
    if (l2 == 0) return dist2(p, v);
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist2(p, {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    });
}
function distToSegment(p: Vector, v: Vector, w: Vector) { return Math.sqrt(distToSegmentSquared(p, v, w)); }
uiCanvas.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
        let closestDist = Infinity;
        let closest;
        for (const stroke of completedStrokes) {
            let dist = distToSegment({ x: (event.clientX - xShift) / scale, y: (event.clientY - yShift) / scale }, { x: stroke[0].coordinates[0], y: stroke[0].coordinates[1] }, { x: stroke[1].coordinates[0], y: stroke[1].coordinates[1] });
            if (dist < closestDist) {
                closestDist = dist
                closest = stroke;
            }
        }
        if (closest && closestDist < 5) {
            let stroke = completedStrokes.indexOf(<Stroke>isStrokeCompleted(closest));
            completedStrokes.splice(stroke, 1); 
            render();
        }
        return;
    }
    mouseDown = true;
    const x = (event.clientX - xShift) / scale;
    const y = (event.clientY - yShift) / scale;
    let dist = Infinity;
    let closestKey = '';
    for (const key in puzzle.vertices) {
        const vertex = puzzle.vertices[key];
        if (((vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2) < dist) {
            dist = (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2;
            closestKey = key;
        }
    }
    if (closestKey && dist < ((2 * getPointSize(closestKey)) / scale) ** 2) {
        clicked = puzzle.vertices[closestKey];
        clicked.selected = 1;
        renderPoints();
    }
    renderCursor();
});
uiCanvas.addEventListener('mouseup', (event) => {
    mouseDown = false;

    if (clicked && clicked.selected && selected && selected.selected) {
        createStroke(clicked, selected);
    }

    if (clicked) clicked.selected = 0;
    clicked = null;
    if (selected) selected.selected = 0;
    selected = null;
    renderCursor();
    renderPoints();
});
uiCanvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (clicked) {
        const x = (mouse.x - xShift) / scale;
        const y = (mouse.y - yShift) / scale;
        let dist = Infinity;
        let closestKey = '';
        for (const key in puzzle.vertices) {
            const vertex = puzzle.vertices[key];
            if (vertex === clicked) continue;
            if (((vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2) < dist) {
                dist = (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2;
                closestKey = key;
            }
        }
        if (closestKey && dist < ((1.5 * getPointSize(closestKey) + 28) / scale) ** 2) {
            if (selected && selected !== puzzle.vertices[closestKey]) {
                selected.selected = 0;
            }
            selected = puzzle.vertices[closestKey];
            selected.selected = 2;
            clicked.selected = 2;
            renderPoints();
        }
        else if (clicked.selected !== 1 || selected) {
            clicked.selected = 1;
            if (selected) selected.selected = 0;
            renderPoints();
        }
    }
    else if (mouseDown) {
        xShift += event.movementX;
        yShift += event.movementY;
        render();
    }

    renderCursor();
});
function renderCursor() {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    if (completed) return;
    if (clicked && mouseDown) {

        if (clicked.selected === 2) {
            cursorCtx.strokeStyle = "#e7ad34";
            cursorCtx.fillStyle = "#e7ad34";
        }
        else {
            cursorCtx.strokeStyle = "black";
            cursorCtx.fillStyle = "black";
        }

        cursorCtx.lineWidth = 4;
        cursorCtx.setLineDash([4, 8]);
        cursorCtx.beginPath();
        cursorCtx.moveTo(scale * (clicked.coordinates[0]) + xShift, scale * (clicked.coordinates[1]) + yShift);
        cursorCtx.lineTo(mouse.x, mouse.y);
        cursorCtx.closePath();
        cursorCtx.stroke();

        cursorCtx.moveTo(mouse.x, mouse.y);
        cursorCtx.arc(mouse.x, mouse.y, 4, 0, 2 * Math.PI);
        cursorCtx.fill();
        cursorCtx.lineWidth = 1;
        cursorCtx.setLineDash([1, 1]);
        cursorCtx.beginPath();
        cursorCtx.arc(mouse.x, mouse.y, 28, 0, 2 * Math.PI);
        cursorCtx.closePath();
        cursorCtx.stroke();
    }
}
function renderUI() {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    uiCtx.fillStyle = "white";
    uiCtx.strokeStyle = "black";
    uiCtx.lineWidth = 2;
    uiCtx.beginPath();
    uiCtx.moveTo(0, uiCanvas.height - 40);
    uiCtx.lineTo(uiCanvas.width, uiCanvas.height - 40);
    uiCtx.closePath();
    uiCtx.stroke();

    uiCtx.beginPath();
    //draaw an equilateral triange
    uiCtx.moveTo(uiCanvas.width / 2, uiCanvas.height - 60);
    uiCtx.lineTo(uiCanvas.width / 2 - 20, uiCanvas.height - 20);
    uiCtx.lineTo(uiCanvas.width / 2 + 20, uiCanvas.height - 20);
    uiCtx.closePath();
    uiCtx.fill();
    uiCtx.stroke();

    uiCtx.textAlign = "left";
    uiCtx.textBaseline = "middle";
    uiCtx.fillStyle = "black";
    uiCtx.font = "24px Arial";
    uiCtx.fillText(puzzle.theme, 50, 100);
    uiCtx.font = "16px Arial";
    uiCtx.fillText(new Date(puzzle.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 50, 200);
    uiCtx.fillText(puzzle.puzzleConstructor, 50, 250);
    uiCtx.font = "14px Arial";
    uiCtx.textAlign = "center";
    uiCtx.fillText(puzzle.shapes.filter(shape => !shape.isPreDrawn && !shape.completed).length.toString(), uiCanvas.width / 2, uiCanvas.height - 33);
}
function render() {
    renderStrokes();
    renderPoints();
    renderShapes();
    renderCursor();
    renderUI();
}
render();