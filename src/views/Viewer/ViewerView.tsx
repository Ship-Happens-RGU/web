import { useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import '@/packages/viewer/src/style.css'

let viewerMainLoaded = false


export default function ViewerView({ active }: { active: boolean }) {
  useEffect(() => {
    if (!viewerMainLoaded) {
      viewerMainLoaded = true
      void import('@/packages/viewer/src/main').then(() => {
        const v = (window as unknown as { __viewer?: { resize: () => void } }).__viewer
        v?.resize()
      })
    }
  }, [])

  useEffect(() => {
    if (active) {
      const id = requestAnimationFrame(() => {
        const v = (window as unknown as { __viewer?: { resize: () => void } }).__viewer
        v?.resize()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [active])

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col bg-[#111111] ${
        active ? '' : 'hidden'
      }`}
    >
      <PageHeader icon="cube" crumbs={[{ label: 'ShipHappens' }, { label: 'Viewer' }]} />

      <div className="viewer-root bp6-dark flex-1">
        <canvas id="gl" />

        <div id="topbar" className="bp6-navbar bp6-dark hidden">
          <span className="name" id="tb-name">—</span>
          <span className="pill hidden" id="tb-layer" />
          <span className="dot" />
          <span className="mono" id="tb-points">—</span>
          <span className="dot" />
          <span className="mono" id="tb-fps">—</span>
          <span className="spacer" />
          <span className="pill hidden" id="tb-tool" />
          <button id="tb-undo" className="ghost" disabled title="Undo (⌘Z)">Undo</button>
          <button id="tb-redo" className="ghost" disabled title="Redo (⇧⌘Z)">Redo</button>
          <button id="tb-save" className="ghost" disabled title="Save as… (⌘S)">Save as…</button>
          <button id="tb-open" className="ghost" title="Open another scan (⌘O)">View from file</button>
          <button id="tb-panel" className="ghost" title="Toggle panel (Tab)">Controls</button>
        </div>

        <div id="drop" className="bg-[#111111]!">
          <div className="flex flex-col items-center justify-center">
            <button id="pick" className="primary px-5! py-2.5! text-sm!">
              View from file
            </button>
            <p id="drop-lede" className="hidden" />
            <p id="drop-hint" className="hidden" />
            <div id="scan-card" className="hidden">
              <button id="pick2" className="ghost wide">View from file</button>
            </div>
            <div id="cached" className="hidden">
              <ul id="cached-list" />
            </div>
          </div>
        </div>

        <div id="loading" className="hidden">
          <div className="card">
            <div className="scanrow"><span className="lab mono">SCAN</span><span id="ld-name">—</span></div>
            <div className="scanrow"><span className="lab mono">POINTS</span><span className="mono" id="ld-points">—</span></div>
            <div className="scanrow"><span className="lab mono">EXTENT</span><span className="mono" id="ld-extent">—</span></div>
            <div className="scanrow"><span className="lab mono">SENSOR</span><span id="ld-sensor">—</span></div>
            <div className="scanrow"><span className="lab mono">FIELDS</span><span id="ld-fields">—</span></div>
            <div className="bar"><i id="ld-bar" /></div>
            <p className="statusline" id="ld-stat">opening…</p>
          </div>
        </div>

        <aside id="panel" className="hidden">
          <div id="grabber" aria-hidden="true"><i /></div>
          <div className="grp" data-grp="layers">
            <h3>Layers</h3>
            <ul id="layer-list" className="mlist" />
            <div className="seg">
              <button id="k-layeradd" className="ghost">Add file…</button>
              <button id="k-layerclone" className="ghost">Clone</button>
            </div>
            <button id="k-layermerge" className="ghost wide">Merge into active…</button>
            <label className="row"><span>Tint this layer</span><input type="checkbox" id="k-layertint" /></label>
            <label className="row"><span>Colour</span><input type="color" id="k-layercolor" defaultValue="#66ccff" /></label>
            <p className="statusline" id="v-layers">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Every visible layer is drawn; the <b>active</b> one (click its name) is what every tool works on. Double-click a name to rename it. <b>Add file…</b> opens another scan alongside this one — so does dropping a file with <b>Shift</b> held — while <b>Open file…</b> replaces everything. A tint multiplies a layer&apos;s colour so two overlapping scans can be told apart.</p>
            </details>
          </div>

          <div className="grp" data-grp="register">
            <h3>Register</h3>
            <label className="row"><span>Reference</span><select id="k-regref" /></label>
            <div className="seg">
              <button id="k-regcentres" className="ghost">Match centres</button>
              <button id="k-regscales" className="ghost">Match scales</button>
            </div>
            <label className="row"><span title="Pairs further apart than this many point spacings are ignored, and the limit tightens as it converges.">Max distance</span><input type="range" id="k-regdist" min="1" max="30" step="0.5" defaultValue="6" /><b className="mono" id="v-regdist">6</b></label>
            <label className="row"><span>Max iterations</span><input type="range" id="k-regiter" min="5" max="80" step="1" defaultValue="30" /><b className="mono" id="v-regiter">30</b></label>
            <button id="k-regicp" className="primary wide">Fine registration (ICP)…</button>
            <button id="k-regdistance" className="ghost wide">Distance to reference</button>
            <p className="statusline" id="v-register">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Moves the <b>active</b> layer onto the reference and never touches the reference. <b>Match centres</b> and <b>Match scales</b> are the coarse step; <b>ICP</b> is point-to-plane and lands on the reference&apos;s own surfaces. <b>Distance to reference</b> writes a scalar field on the active layer, so the colour ramp and the histogram show where the two disagree.</p>
            </details>
          </div>

          <div className="grp">
            <h3>Appearance</h3>
            <label className="row"><span>Colour</span>
              <select id="k-color" defaultValue="0">
                <option value="0">RGB</option>
                <option value="1">Intensity</option>
                <option value="2">RGB × Intensity</option>
                <option value="3">Elevation</option>
                <option value="4">Normals</option>
                <option value="5" id="k-color-sf" disabled>Scalar field</option>
                <option value="6">Flat</option>
              </select>
            </label>
            <label className="row"><span>Point size</span><input type="range" id="k-size" min="0.5" max="8" step="0.1" defaultValue="2.0" /><b className="mono" id="v-size">2.0</b></label>
            <label className="row"><span>Sizing</span>
              <select id="k-sizemode" defaultValue="1"><option value="1">Adaptive</option><option value="0">Fixed</option></select>
            </label>
            <label className="row"><span>Round points</span><input type="checkbox" id="k-round" defaultChecked /></label>
          </div>

          <div className="grp">
            <h3>Lighting</h3>
            <label className="row"><span>EDL</span><input type="checkbox" id="k-edl" defaultChecked /></label>
            <label className="row"><span>Strength</span><input type="range" id="k-edlstr" min="0" max="1.5" step="0.01" defaultValue="0.32" /><b className="mono" id="v-edlstr">0.32</b></label>
            <label className="row"><span>Radius</span><input type="range" id="k-edlrad" min="0.5" max="5" step="0.1" defaultValue="1.4" /><b className="mono" id="v-edlrad">1.4</b></label>
            <label className="row"><span>Normal shading</span><input type="checkbox" id="k-nrm" /></label>
          </div>

          <div className="grp">
            <h3>Tone</h3>
            <label className="row"><span>Brightness</span><input type="range" id="k-bright" min="0.2" max="3" step="0.01" defaultValue="1" /><b className="mono" id="v-bright">1.00</b></label>
            <label className="row"><span>Gamma</span><input type="range" id="k-gamma" min="0.4" max="2.4" step="0.01" defaultValue="1" /><b className="mono" id="v-gamma">1.00</b></label>
            <div className="row col">
              <span>Intensity range</span>
              <canvas id="hist" width="240" height="42" />
              <div className="dual">
                <input type="range" id="k-imin" min="0" max="1" step="0.005" defaultValue="0" />
                <input type="range" id="k-imax" min="0" max="1" step="0.005" defaultValue="1" />
              </div>
              <b className="mono" id="v-irange">0.00 – 1.00</b>
            </div>
          </div>

          <div className="grp">
            <h3>Clipping</h3>
            <label className="row"><span>Height min</span><input type="range" id="k-zmin" min="0" max="1" step="0.005" defaultValue="0" /><b className="mono" id="v-zmin">—</b></label>
            <label className="row"><span>Height max</span><input type="range" id="k-zmax" min="0" max="1" step="0.005" defaultValue="1" /><b className="mono" id="v-zmax">—</b></label>
          </div>

          <div className="grp">
            <h3>Performance</h3>
            <label className="row"><span>Points per frame</span>
              <select id="k-budget" defaultValue="8000000">
                <option value="1000000">1 M</option>
                <option value="2000000">2 M</option>
                <option value="4000000">4 M</option>
                <option value="8000000">8 M</option>
                <option value="16000000">16 M</option>
                <option value="32000000">32 M</option>
              </select>
            </label>
            <label className="row"><span>Density</span><input type="range" id="k-density" min="0.3" max="4" step="0.05" defaultValue="2" /><b className="mono" id="v-density">2.00</b></label>
            <label className="row"><span>Max point px</span><input type="range" id="k-maxpx" min="2" max="24" step="0.5" defaultValue="7" /><b className="mono" id="v-maxpx">7.0</b></label>
            <label className="row"><span>While moving</span><input type="range" id="k-moving" min="0.1" max="1" step="0.05" defaultValue="0.35" /><b className="mono" id="v-moving">0.35</b></label>
            <p className="statusline" id="v-stats">—</p>
            <label className="row"><span>In memory</span>
              <select id="k-load" defaultValue="1">
                <option value="1">Everything</option>
                <option value="2">1 in 2</option>
                <option value="4">1 in 4</option>
                <option value="10">1 in 10</option>
                <option value="30">1 in 30</option>
              </select>
            </label>
            <p className="statusline" id="v-loaded">—</p>
            <div className="seg">
              <button id="k-undo" className="ghost" disabled>Undo</button>
              <button id="k-redo" className="ghost" disabled>Redo</button>
            </div>
            <button id="k-save" className="primary wide" disabled>Save as…</button>
            <button id="k-reload" className="ghost wide">Reload</button>
            <button id="k-open" className="ghost wide">Open another scan…</button>
            <p className="hint">Undo/redo cover crop and section edits. <b>Save as…</b> writes a copy of the current points to a file you choose, updates the on-device cache if there is one, and clears undo. <b>⌘Z</b> / <b>⇧⌘Z</b> / <b>⌘S</b>. Escape cancels a crop region.</p>
            <p className="statusline" id="v-hist">—</p>
          </div>

          <div className="grp" data-grp="crop">
            <h3>Crop</h3>
            <label className="row"><span>Shape</span>
              <select id="k-cropshape" defaultValue="box"><option value="box">Box</option><option value="sphere">Sphere</option><option value="slab">Slab</option></select>
            </label>
            <label className="row"><span>Show region</span><input type="checkbox" id="k-cropon" /></label>
            <div className="seg">
              <button id="k-cropkeep" className="ghost on">Keep inside</button>
              <button id="k-cropdel" className="ghost">Remove inside</button>
            </div>
            <div className="seg">
              <button id="k-cropmove" className="ghost on">Move</button>
              <button id="k-croprotate" className="ghost">Rotate</button>
              <button id="k-cropresize" className="ghost">Resize</button>
            </div>
            <label className="row"><span>Hide outside</span><input type="checkbox" id="k-crophide" /></label>
            <label className="row"><span>Size</span><input type="range" id="k-cropsize" min="0" max="1" step="0.002" defaultValue="0.35" /><b className="mono" id="v-cropsize">—</b></label>
            <label className="row box-only"><span>Depth</span><input type="range" id="k-cropsy" min="0" max="1" step="0.002" defaultValue="0.35" /><b className="mono" id="v-cropsy">—</b></label>
            <label className="row box-only"><span>Height</span><input type="range" id="k-cropsz" min="0" max="1" step="0.002" defaultValue="0.35" /><b className="mono" id="v-cropsz">—</b></label>
            <label className="row prism-only"><span>Prism depth</span><input type="range" id="k-prismdepth" min="0.004" max="1" step="0.004" defaultValue="1" /><b className="mono" id="v-prismdepth">—</b></label>
            <button id="k-cropcentre" className="ghost wide">Centre on orbit point</button>

            <p className="lab mono">NEW REGION</p>
            <div className="row"><span>Shape</span>
              <select id="k-newshape" defaultValue="box"><option value="box">Box</option><option value="sphere">Sphere</option></select>
            </div>
            <button id="k-place" className="ghost wide">Create region (S)</button>
            <div className="seg region-active">
              <button id="k-grow" className="ghost">Grow ×1.5</button>
              <button id="k-shrink" className="ghost">Shrink ÷1.5</button>
            </div>
            <button id="k-fitcontents" className="ghost wide region-active">Fit to contents</button>
            <button id="k-segment" className="ghost wide">Draw an outline… (⇧S)</button>
            <div className="seg">
              <button id="k-cropcancel" className="ghost">Cancel region</button>
              <button id="k-cropapply" className="primary">Apply crop…</button>
            </div>
            <p className="statusline" id="v-crop">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Click <b>Create region</b> then click a point on the cloud: a small shape appears there, ready to resize. <b>Grow</b>, the handles, the size sliders, or <b>Alt</b> + scroll while it is active all enlarge it; <b>Fit to contents</b> grows it until it stops finding new points and then tightens onto them.</p>
              <p className="hint">Drag the arrows to move, the rings to rotate, the handles to resize. Double-click a point to move the orbit centre, then centre the region there. <b>Keep inside</b> dims everything outside the region; <b>Remove inside</b> dims what is inside it — either way the preview is what Apply will leave behind. <b>Escape</b> cancels the region.</p>
            </details>
          </div>

          <div className="grp" data-grp="sections">
            <h3>Sections</h3>
            <button id="k-secadd" className="ghost wide">Add section at orbit point</button>
            <ul id="sec-list" className="mlist" />
            <p className="statusline" id="v-sections">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Bounding shapes, combined as a union: keep only what lies inside any of them, or mark one <b>Remove</b> to drop what is inside it. A section is a slab you move, tilt and thicken with the gizmo — floors, a wall, a corridor. A drawn region (<b>S</b>) is an outline extruded along the direction you drew it from, so you can orbit around it and see exactly what it holds.</p>
            </details>
          </div>

          <div className="grp" data-grp="clean">
            <h3>Clean</h3>
            <label className="row"><span title="How many nearest points each measurement looks at.">Neighbours</span><input type="range" id="k-ank2" min="3" max="64" step="1" defaultValue="16" /><b className="mono" id="v-ank2">16</b></label>
            <label className="row"><span title="How many standard deviations from the mean a point may be before it is dropped.">Strictness</span><input type="range" id="k-ansigma" min="0.5" max="4" step="0.1" defaultValue="1.0" /><b className="mono" id="v-ansigma">1.0 σ</b></label>

            <button id="k-ansor" className="primary wide">Remove outliers…</button>
            <button id="k-annoise" className="ghost wide">Remove noise…</button>
            <details className="sub">
              <summary>Noise filter options</summary>
              <label className="row"><span title="CloudCompare calls this the neighbours option. A sphere is its default.">Neighbourhood</span>
                <select id="k-annbmode" defaultValue="radius">
                  <option value="radius">Sphere of a radius</option>
                  <option value="knn">Nearest neighbours</option>
                </select>
              </label>
              <label className="row"><span>Radius</span><input type="range" id="k-annradius" min="0.01" max="2" step="0.01" defaultValue="0.15" /><b className="mono" id="v-annradius">0.15 m</b></label>
              <label className="row"><span title="CloudCompare calls this the error option. Relative is its default.">Threshold</span>
                <select id="k-anerrmode" defaultValue="relative">
                  <option value="relative">Relative, in sigma</option>
                  <option value="absolute">Absolute distance</option>
                </select>
              </label>
              <label className="row"><span>Absolute</span><input type="range" id="k-annabs" min="0.001" max="0.5" step="0.001" defaultValue="0.02" /><b className="mono" id="v-annabs">0.020 m</b></label>
              <label className="row"><span title="Points with fewer than three neighbours cannot have a plane fitted, so the filter has nothing to judge them by.">Remove isolated points</span><input type="checkbox" id="k-annrip" /></label>
            </details>
            <button id="k-andup" className="ghost wide">Remove duplicates…</button>
            <p className="statusline" id="v-clean">—</p>
            <p className="hint">CloudCompare&apos;s SOR and noise filters, same settings, same points removed.</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint"><b>Remove outliers</b> measures each point&apos;s mean distance to its neighbours and drops the ones beyond the mean plus <b>Strictness</b> standard deviations, judged over the whole cloud. A few very distant points can push that threshold out past the real outliers, so crop a stray reflection away first.</p>
              <p className="hint"><b>Remove noise</b> fits a plane to the points around each point and drops it if it sits further off that plane than its own neighbours&apos; spread allows. The threshold is local, so a smooth wall is judged strictly and a hedge loosely. Real edges survive because they still fit a plane.</p>
              <p className="hint">Every removal is one undoable step.</p>
            </details>
          </div>

          <div className="grp" data-grp="transform">
            <h3>Transform</h3>
            <p className="statusline" id="v-transform">no transform</p>

            <p className="lab mono">TRANSLATE</p>
            <div className="trio">
              <input type="number" id="k-tx" step="0.1" defaultValue="0" aria-label="East / X metres" />
              <input type="number" id="k-ty" step="0.1" defaultValue="0" aria-label="North / Y metres" />
              <input type="number" id="k-tz" step="0.1" defaultValue="0" aria-label="Up / Z metres" />
            </div>
            <button id="k-tmove" className="ghost wide">Move by these metres</button>

            <p className="lab mono">ROTATE</p>
            <div className="row"><span>Axis</span>
              <select id="k-taxis" defaultValue="z"><option value="z">Z (plan)</option><option value="x">X</option><option value="y">Y</option></select>
            </div>
            <div className="row"><span>Degrees</span><input type="number" id="k-tdeg" step="0.5" defaultValue="90" aria-label="degrees" /></div>
            <div className="row"><span>About</span>
              <select id="k-tabout" defaultValue="centre"><option value="centre">Bounding-box centre</option><option value="origin">Origin</option></select>
            </div>
            <button id="k-trot" className="ghost wide">Rotate</button>

            <p className="lab mono">SCALE</p>
            <div className="row"><span>Factor</span><input type="number" id="k-tscale" step="0.01" defaultValue="1" aria-label="uniform scale factor" /></div>
            <button id="k-tscalego" className="ghost wide">Scale about the centre</button>

            <p className="lab mono">FIT</p>
            <button id="k-tlevel" className="ghost wide">Level (make horizontal)</button>
            <button id="k-tcentre" className="ghost wide">Move centre to origin</button>
            <button id="k-tmincorner" className="ghost wide">Move min corner to origin</button>

            <p className="lab mono">BY HAND</p>
            <label className="row"><span>Drag to move/rotate</span><input type="checkbox" id="k-tdrag" /></label>
            <div className="seg">
              <button id="k-tmodemove" className="ghost on">Move</button>
              <button id="k-tmoderotate" className="ghost">Rotate</button>
              <button id="k-tmodescale" className="ghost">Scale</button>
            </div>

            <div className="seg">
              <button id="k-tmatrix" className="ghost">Apply matrix…</button>
              <button id="k-treset" className="ghost">Reset</button>
            </div>

            <p className="lab mono">GLOBAL SHIFT</p>
            <p className="statusline" id="v-shift">—</p>
            <button id="k-tshift" className="ghost wide">Edit global shift…</button>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Moves the whole cloud without touching a point. The records stay exactly as they are and a 4&times;4 matrix is applied when they are drawn, tested, analysed and exported — instant, lossless and undoable. <b>Save a copy</b> bakes it into the file.</p>
              <p className="hint">The gizmo grabs the whole cloud at its bounding-box centre. It shares the handles with the crop region, so turning it on releases the crop gizmo and vice versa. One undo step per drag.</p>
              <p className="hint">The scan&apos;s own pose offset, added back on export and shown in the coordinate readout. It is not part of the transform above and moves nothing on screen.</p>
            </details>
          </div>

          <div className="grp" data-grp="analysis">
            <h3>Analysis</h3>
            <label className="row"><span title="How many nearest points each measurement looks at. Larger is smoother and slower.">Neighbours</span><input type="range" id="k-ank" min="6" max="64" step="1" defaultValue="16" /><b className="mono" id="v-ank">16</b></label>

            <p className="lab mono">NORMALS</p>
            <div className="seg">
              <button id="k-annorm" className="ghost">Compute</button>
              <button id="k-anorient" className="ghost">Orient</button>
              <button id="k-aninvert" className="ghost">Invert</button>
            </div>
            <p className="hint">Reconstruction and shading both need normals. <b>Orient</b> turns them toward the scanner stations.</p>

            <p className="lab mono">MEASURE</p>
            <label className="row"><span>Feature</span>
              <select id="k-anfeat" defaultValue="roughness">
                <option value="roughness">Roughness</option>
                <option value="curvature">Curvature</option>
                <option value="planarity">Planarity</option>
                <option value="linearity">Linearity</option>
                <option value="sphericity">Sphericity</option>
                <option value="anisotropy">Anisotropy</option>
                <option value="omnivariance">Omnivariance</option>
                <option value="eigenentropy">Eigenentropy</option>
                <option value="verticality">Verticality</option>
                <option value="volume_density">Volume density</option>
                <option value="surface_density">Surface density</option>
                <option value="neighbours">Neighbour count</option>
                <option value="eig1">1st eigenvalue</option>
                <option value="eig2">2nd eigenvalue</option>
                <option value="eig3">3rd eigenvalue</option>
              </select>
            </label>
            <button id="k-anfeatgo" className="ghost wide">Compute feature</button>

            <p className="lab mono">CLUSTER AND THIN</p>
            <label className="row"><span>Spacing</span><input type="range" id="k-anspace" min="0.01" max="2" step="0.01" defaultValue="0.1" /><b className="mono" id="v-anspace">0.10 m</b></label>
            <div className="seg">
              <button id="k-ancc" className="ghost">Components</button>
              <button id="k-ansub" className="ghost">Thin…</button>
            </div>
            <p className="hint"><b>Components</b> labels groups of points that touch within the spacing. <b>Thin</b> keeps one point per cube of that size.</p>
            <p className="statusline" id="v-analysis">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">A feature is one number per point, computed from the shape of its neighbourhood and written as a scalar field. Colour by it with <b>Colour → Scalar field</b>, or narrow the range to isolate part of the cloud.</p>
            </details>
          </div>

          <div className="grp" data-grp="raster">
            <h3>Raster</h3>
            <label className="row"><span>Cell size</span><input type="range" id="k-rcell" min="0.01" max="2" step="0.01" defaultValue="0.25" /><b className="mono" id="v-rcell">0.25 m</b></label>
            <label className="row"><span>Value</span>
              <select id="k-rstat" defaultValue="max">
                <option value="max">Highest point</option>
                <option value="min">Lowest point</option>
                <option value="mean">Mean height</option>
                <option value="density">Points per cell</option>
                <option value="field">Mean scalar field</option>
              </select>
            </label>
            <label className="row"><span>Along</span>
              <select id="k-raxis" defaultValue="z"><option value="z">Z (a height model)</option><option value="x">X</option><option value="y">Y</option></select>
            </label>
            <label className="row"><span>Fill empty cells</span>
              <select id="k-rfill" defaultValue="none"><option value="none">Leave empty</option><option value="nearest">Nearest</option><option value="idw">Inverse distance</option></select>
            </label>
            <button id="k-rasterize" className="primary wide">Rasterize</button>
            <p className="statusline" id="v-raster">—</p>
            <label className="row raster-have"><span>Show the draped grid</span><input type="checkbox" id="k-rshow" defaultChecked /></label>
            <button id="k-rsavepng" className="ghost wide raster-have">Save PNG + world file…</button>

            <p className="lab mono">CONTOURS</p>
            <label className="row"><span>Interval</span><input type="range" id="k-cint" min="0.05" max="5" step="0.05" defaultValue="0.5" /><b className="mono" id="v-cint">0.50 m</b></label>
            <button id="k-contours" className="ghost wide">Draw contours</button>
            <div className="seg contour-have">
              <button id="k-cdxf" className="ghost">Save DXF…</button>
              <button id="k-cgeojson" className="ghost">Save GeoJSON…</button>
            </div>
            <p className="statusline" id="v-contours">—</p>

            <p className="lab mono">VOLUME</p>
            <label className="row"><span>Against</span><select id="k-vref" /></label>
            <label className="row"><span>Plane height</span><input type="number" id="k-vplane" step="0.1" defaultValue="0" /></label>
            <button id="k-volume" className="ghost wide">Measure the volume</button>
            <p className="statusline" id="v-volume">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">A 2.5D volume: the difference between two height rasters over the same cells, one cell area at a time. Cut and fill are reported separately because their sum hides both.</p>
            </details>
          </div>

          <div className="grp" data-grp="fit">
            <h3>Fit</h3>
            <div className="seg">
              <button id="k-fitplane" className="ghost">Plane</button>
              <button id="k-fitsphere" className="ghost">Sphere</button>
            </div>
            <div className="seg">
              <button id="k-fitcyl" className="ghost">Cylinder</button>
              <button id="k-fitcircle" className="ghost">Circle</button>
            </div>
            <p className="statusline" id="v-fit">—</p>
            <button id="k-fitclear" className="ghost wide">Clear the drawn shape</button>

            <p className="lab mono">DETECT</p>
            <label className="row"><span title="How far a point may be from a shape and still count as part of it.">Tolerance</span><input type="range" id="k-dettol" min="0.002" max="0.2" step="0.002" defaultValue="0.02" /><b className="mono" id="v-dettol">0.02 m</b></label>
            <label className="row"><span>Min points</span><input type="range" id="k-detmin" min="100" max="20000" step="100" defaultValue="2000" /><b className="mono" id="v-detmin">2,000</b></label>
            <label className="row"><span>Look for</span>
              <select id="k-detkinds" defaultValue="plane,sphere,cylinder">
                <option value="plane">Planes</option>
                <option value="plane,cylinder">Planes and cylinders</option>
                <option value="plane,sphere,cylinder">Planes, spheres, cylinders</option>
              </select>
            </label>
            <button id="k-detect" className="primary wide">Detect shapes…</button>
            <ul id="det-list" className="mlist" />
            <div className="seg det-have">
              <button id="k-detkeep" className="ghost">Keep only inliers</button>
              <button id="k-detremove" className="ghost">Remove inliers</button>
            </div>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Fits a primitive to the <b>active region&apos;s contents</b>, or to the whole layer when no region is active. The RMS is the number that says whether to believe it.</p>
            </details>
          </div>

          <div className="grp sf-have" data-grp="field">
            <h3>Scalar field</h3>
            <p className="statusline" id="v-sfname">no field</p>
            <canvas id="sf-hist" height="52" />
            <label className="row"><span>Display from</span><input type="range" id="k-sfmin" min="0" max="1000" step="1" defaultValue="0" /><b className="mono" id="v-sfmin">—</b></label>
            <label className="row"><span>to</span><input type="range" id="k-sfmax" min="0" max="1000" step="1" defaultValue="1000" /><b className="mono" id="v-sfmax">—</b></label>
            <button id="k-sfauto" className="ghost wide">Auto range (2–98%)</button>
            <label className="row"><span>Filter points</span><input type="checkbox" id="k-sffilter" /></label>
            <label className="row sf-filtering"><span>Keep from</span><input type="range" id="k-sflo" min="0" max="1000" step="1" defaultValue="0" /><b className="mono" id="v-sflo">—</b></label>
            <label className="row sf-filtering"><span>to</span><input type="range" id="k-sfhi" min="0" max="1000" step="1" defaultValue="1000" /><b className="mono" id="v-sfhi">—</b></label>
            <label className="row sf-filtering"><span>Hide the rest</span><input type="checkbox" id="k-sfhide" /></label>
            <button id="k-sfapply" className="primary wide sf-filtering">Delete points outside…</button>
            <button id="k-sfclear" className="ghost wide">Clear field</button>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">A field is one number per point. Colour by it with <b>Colour → Scalar field</b>, narrow the display range to see detail, or filter to keep only part of the cloud.</p>
            </details>
          </div>

          <div className="grp" data-grp="mesh">
            <h3>Mesh</h3>

            <label className="row"><span>Detail</span><input type="range" id="k-mvox" min="0.5" max="60" step="0.5" defaultValue="6" /><b className="mono" id="v-mvox">6 cm</b></label>
            <label className="row"><span>Smoothing</span><input type="range" id="k-msmooth" min="0" max="6" step="1" defaultValue="2" /><b className="mono" id="v-msmooth">2</b></label>
            <label className="row"><span>Fill gaps</span><input type="range" id="k-mtrunc" min="1" max="4" step="0.5" defaultValue="2" /><b className="mono" id="v-mtrunc">2.0</b></label>
            <button id="k-mbuild" className="primary wide">Build from points…</button>
            <p className="statusline" id="v-mesh">—</p>

            <p className="lab mono">SHOW</p>
            <div className="seg">
              <button id="k-disppoints" className="ghost on">Points</button>
              <button id="k-dispmesh" className="ghost">Mesh</button>
              <button id="k-dispboth" className="ghost">Both</button>
            </div>
            <label className="row"><span>Flat shading</span><input type="checkbox" id="k-mflat" /></label>

            <p className="lab mono mesh-have">EDIT</p>
            <div className="seg mesh-have">
              <button id="k-meshflip" className="ghost">Flip</button>
              <button id="k-meshsmooth" className="ghost">Smooth</button>
              <button id="k-meshdecim" className="ghost">Decimate</button>
            </div>
            <label className="row mesh-have"><span>Smooth passes</span><input type="range" id="k-meshiter" min="1" max="20" step="1" defaultValue="5" /><b className="mono" id="v-meshiter">5</b></label>
            <label className="row mesh-have"><span>Keep volume</span><input type="checkbox" id="k-meshtaubin" defaultChecked /></label>
            <label className="row mesh-have"><span>Decimate to</span><input type="range" id="k-meshcell" min="0.5" max="100" step="0.5" defaultValue="10" /><b className="mono" id="v-meshcell">10 cm</b></label>

            <p className="lab mono mesh-have">MEASURE</p>
            <button id="k-meshmeasure" className="ghost wide mesh-have">Area and volume</button>

            <p className="lab mono mesh-have">COMPARE</p>
            <label className="row mesh-have"><span>Distance to</span><select id="k-meshref" /></label>
            <label className="row mesh-have"><span>Signed</span><input type="checkbox" id="k-meshsigned" /></label>
            <button id="k-meshdist" className="ghost wide mesh-have">Distance from this cloud</button>

            <p className="lab mono mesh-have">SAMPLE</p>
            <label className="row mesh-have"><span>Sample</span>
              <select id="k-meshsmode" defaultValue="count"><option value="count">points in all</option><option value="density">points per m²</option></select>
            </label>
            <label className="row mesh-have"><span>How many</span><input type="number" id="k-meshsval" min="100" step="1000" defaultValue="200000" /></label>
            <button id="k-meshsample" className="ghost wide mesh-have">Sample to a new layer</button>

            <label className="row mesh-have"><span>Format</span>
              <select id="k-meshfmt" defaultValue="ply"><option value="ply">PLY (binary)</option><option value="obj">OBJ</option><option value="stl">STL (binary)</option></select>
            </label>
            <button id="k-meshsave" className="primary wide mesh-have">Export mesh…</button>
            <button id="k-mclear" className="ghost wide mesh-have">Discard mesh</button>
            <p className="statusline" id="v-meshinfo">no mesh yet</p>

            <button id="k-meshopen" className="ghost wide">Import a mesh…</button>
            <p className="hint">Opens a PLY, OBJ or STL as a layer of its own, to compare against or edit.</p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint"><b>Build from points</b> is surface reconstruction: it needs normals, and writes a triangle mesh as a separate object that you can show, hide, measure or export. <b>Detail</b> is the voxel size, so smaller is finer and slower, and below the scan&apos;s own point spacing it only adds noise. <b>Fill gaps</b> widens the band each point writes, closing small holes at the cost of rounding sharp edges.</p>
              <p className="hint"><b>Area</b> and <b>volume</b> are measured through the layer&apos;s transform. A volume only means anything when the mesh is closed, so the boundary edge count is reported next to it. <b>Smooth</b> is Taubin with Keep volume on and plain Laplacian with it off. <b>Decimate</b> is vertex clustering at the cell you set, which is fast but cannot hit an exact triangle count.</p>
              <p className="hint"><b>Distance from this cloud</b> measures every point of the active point layer to the nearest triangle of the mesh layer you pick, and writes it as a scalar field.</p>
            </details>
          </div>

          <div className="grp" data-grp="measure">
            <h3>Measure</h3>
            <div className="seg">
              <button id="k-measure" className="ghost">Distance</button>
              <button id="k-measureclear" className="ghost">Clear</button>
            </div>
            <p className="hint">Click two points. <b>M</b> toggles. Single-click anywhere shows coordinates.</p>
            <ul id="measure-list" className="mlist mono" />
          </div>

          <div className="grp" data-grp="export">
            <h3>Export</h3>
            <label className="row"><span>Format</span>
              <select id="k-fmt" defaultValue="e57">
                <option value="e57">E57</option>
                <option value="las">LAS 1.2</option>
                <option value="laz">LAZ (compressed)</option>
                <option value="ply">PLY (binary)</option>
              </select>
            </label>
            <label className="row"><span>Keep</span>
              <select id="k-expstride" defaultValue="1">
                <option value="1">Every point</option>
                <option value="2">1 in 2</option>
                <option value="4">1 in 4</option>
                <option value="10">1 in 10</option>
              </select>
            </label>
            <button id="k-export" className="primary wide">Save a copy…</button>
            <p className="statusline" id="v-export">—</p>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Writes what is in memory — the crop, if you applied one. The original file is never touched.</p>
            </details>
          </div>

          <div className="grp" data-grp="stations">
            <h3>Stations</h3>
            <label className="row"><span>Show stations</span><input type="checkbox" id="k-stations" defaultChecked /></label>
            <p className="statusline" id="v-stations">—</p>
            <div id="bubble-ui" className="hidden">
              <label className="row"><span>Points over photo</span><input type="range" id="k-blend" min="0" max="1" step="0.01" defaultValue="0.35" /><b className="mono" id="v-blend">0.35</b></label>
              <button id="k-bubble-exit" className="ghost wide">Leave photo</button>
            </div>
            <p className="hint">Click a station marker to look around its 360° photo. Walk away and it fades.</p>
          </div>

          <div className="grp" data-grp="cache">
            <h3>Cache</h3>
            <p className="statusline" id="v-cache">—</p>
            <button id="k-cache" className="ghost wide">Cache this scan on this device</button>
            <button id="k-cacheremove" className="ghost wide hidden">Remove from cache</button>
            <button id="k-viewlink" className="ghost wide">Copy view link</button>
            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">Writes decoded cells on this device so the next open is instant. <b>Save</b> (in Performance) also updates this cache after a crop, and clears undo.</p>
            </details>
          </div>

          <div className="grp">
            <h3>View</h3>
            <div className="seg">
              <button id="k-orbit" className="ghost on">Orbit</button>
              <button id="k-fly" className="ghost">Fly</button>
            </div>
            <label className="row"><span>Fly speed</span><input type="range" id="k-flyspeed" min="0.1" max="30" step="0.1" defaultValue="2" /><b className="mono" id="v-flyspeed">2.0</b></label>
            <button id="k-top" className="ghost wide">Top down</button>
            <button id="k-fit" className="ghost wide">Fit to cloud</button>
            <p className="hint" id="v-navhint">Drag to orbit · scroll zooms toward the cursor · <b>double-click</b> a point to orbit around it</p>
          </div>
        </aside>

        <div id="toolbar" className="hidden">
          <button data-tool="orbit" className="on">Orbit</button>
          <button data-tool="fly">Fly</button>
          <button data-tool="measure">Measure</button>
          <button data-tool="segment">Region</button>
          <button data-tool="crop">Crop</button>
          <button data-tool="photo" className="hidden">Leave photo</button>
        </div>
        <div id="joy" className="hidden">
          <div className="pad">
            <button data-key="w" className="up">▲</button>
            <button data-key="a" className="left">◀</button>
            <button data-key="d" className="right">▶</button>
            <button data-key="s" className="down">▼</button>
          </div>
          <div className="vert"><button data-key="e">up</button><button data-key="q">down</button></div>
        </div>
        <svg id="seg" className="hidden"><polygon id="seg-fill" /><polyline id="seg-line" /></svg>
        <div id="placebar" className="hidden">
          <span className="mono" id="place-hint">Click a point to place a region · Esc cancels</span>
          <button id="place-cancel" className="ghost">Cancel</button>
        </div>
        <div id="segbar" className="hidden">
          <span className="mono" id="seg-hint">Click to trace a shape · double-click to close · Esc to cancel</span>
          <button id="seg-region" className="primary" disabled>Create region</button>
          <button id="seg-in" className="ghost" disabled>Keep inside now</button>
          <button id="seg-out" className="ghost" disabled>Remove inside now</button>
          <button id="seg-cancel" className="ghost">Cancel</button>
        </div>
        <div id="coord" className="mono hidden" />
        <div id="labels" />
        <div id="modal" className="hidden"><div className="card"><h2 id="modal-title" /><div id="modal-body" /><div className="btns" id="modal-btns" /></div></div>
        <div id="busy" className="hidden"><div className="card"><p id="busy-text">Working…</p><div className="bar"><i id="busy-bar" /></div><button id="busy-stop" className="ghost wide hidden">Cancel</button></div></div>
        <div id="err" className="hidden" />
      </div>
    </div>
  )
}
