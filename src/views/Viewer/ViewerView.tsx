import { useEffect } from 'react'
import {
  Alignment,
  Button,
  ButtonGroup,
  Card,
  H2,
  H3,
  HTMLSelect,
  Intent,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  Switch,
  Tag,
  Text,
} from '@blueprintjs/core'
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
      <PageHeader
        icon="cube"
        crumbs={[{ label: 'ShipHappens' }, { label: 'Viewer' }]}
      />

      <div className="viewer-root bp6-dark flex-1">
        <canvas id="gl" />

        <Navbar id="topbar" className="hidden">
          <NavbarGroup align={Alignment.START} className="flex items-center gap-2.5">
            <Text className="name" id="tb-name">
              —
            </Text>

            <Tag id="tb-layer" minimal className="hidden" />

            <NavbarDivider />

            <Text className="mono" id="tb-points">
              —
            </Text>

            <NavbarDivider />

            <Text className="mono" id="tb-fps">
              —
            </Text>
          </NavbarGroup>

          <span className="spacer" />

          <NavbarGroup align={Alignment.END} className="flex items-center gap-2">
            <Tag id="tb-tool" intent={Intent.PRIMARY} className="hidden" />

            <Button id="tb-undo" size="small" disabled title="Undo (⌘Z)">
              Undo
            </Button>

            <Button id="tb-redo" size="small" disabled title="Redo (⇧⌘Z)">
              Redo
            </Button>

            <Button id="tb-save" size="small" disabled title="Save as… (⌘S)">
              Save as…
            </Button>

            <Button
              id="tb-open"
              size="small"
              icon="document-open"
              title="Open another scan (⌘O)"
            >
              View from file
            </Button>

            <Button
              id="tb-panel"
              size="small"
              icon="panel-stats"
              title="Toggle panel (Tab)"
            >
              Controls
            </Button>
          </NavbarGroup>
        </Navbar>

        <div id="drop" className="bg-[#111111]!">
          <div className="flex flex-col items-center justify-center">
            <Button
              id="pick"
              intent={Intent.PRIMARY}
              size="large"
              icon="document-open"
            >
              View from file
            </Button>

            <p id="drop-lede" className="hidden" />
            <p id="drop-hint" className="hidden" />

            <div id="scan-card" className="hidden">
              <Button id="pick2" fill>
                View from file
              </Button>
            </div>

            <div id="cached" className="hidden">
              <ul id="cached-list" />
            </div>
          </div>
        </div>

        <div id="loading" className="hidden over">
          <Card elevation={3} className="card">
            <div className="scanrow hidden">
              <span className="lab mono">SCAN</span>
              <span id="ld-name">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">POINTS</span>
              <span className="mono" id="ld-points">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">EXTENT</span>
              <span className="mono" id="ld-extent">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">SENSOR</span>
              <span id="ld-sensor">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">FIELDS</span>
              <span id="ld-fields">—</span>
            </div>

            <div className="bar">
              <i id="ld-bar" />
            </div>

            <p className="statusline" id="ld-stat">
              opening…
            </p>
          </Card>
        </div>

        <Card id="panel" elevation={2} className="hidden p-0!">
          <div id="grabber" aria-hidden="true">
            <i />
          </div>

          <div className="grp" data-grp="layers">
            <H3>Layers</H3>

            <ul id="layer-list" className="mlist" />

            <ButtonGroup fill className="mb-2">
              <Button id="k-layeradd" size="small">
                Add file…
              </Button>

              <Button id="k-layerclone" size="small">
                Clone
              </Button>
            </ButtonGroup>

            <Button id="k-layermerge" fill size="small" className="mb-1.5">
              Merge into active…
            </Button>

            <Switch
              id="k-layertint"
              label="Tint this layer"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <label className="row">
              <span>Colour</span>
              <input type="color" id="k-layercolor" defaultValue="#66ccff" />
            </label>

            <p className="statusline" id="v-layers">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Every visible layer is drawn; the <b>active</b> one (click its name) is what every tool works on. Double-click a name to rename it. <b>Add file…</b> opens another scan alongside this one — so does dropping a file with <b>Shift</b> held — while <b>Open file…</b> replaces everything. A tint multiplies a layer&apos;s colour so two overlapping scans can be told apart.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="register">
            <H3>Register</H3>

            <label className="row">
              <span>Reference</span>
              <HTMLSelect id="k-regref" />
            </label>

            <ButtonGroup fill className="mb-2">
              <Button id="k-regcentres" size="small">
                Match centres
              </Button>

              <Button id="k-regscales" size="small">
                Match scales
              </Button>
            </ButtonGroup>

            <label className="row">
              <span title="Pairs further apart than this many point spacings are ignored, and the limit tightens as it converges.">
                Max distance
              </span>
              <input
                type="range"
                id="k-regdist"
                min="1"
                max="30"
                step="0.5"
                defaultValue="6"
              />
              <b className="mono" id="v-regdist">
                6
              </b>
            </label>

            <label className="row">
              <span>Max iterations</span>
              <input
                type="range"
                id="k-regiter"
                min="5"
                max="80"
                step="1"
                defaultValue="30"
              />
              <b className="mono" id="v-regiter">
                30
              </b>
            </label>

            <Button
              id="k-regicp"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Fine registration (ICP)…
            </Button>

            <Button id="k-regdistance" fill size="small" className="mb-1.5">
              Distance to reference
            </Button>

            <p className="statusline" id="v-register">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Moves the <b>active</b> layer onto the reference and never touches the reference. <b>Match centres</b> and <b>Match scales</b> are the coarse step; <b>ICP</b> is point-to-plane and lands on the reference&apos;s own surfaces. <b>Distance to reference</b> writes a scalar field on the active layer, so the colour ramp and the histogram show where the two disagree.
              </p>
            </details>
          </div>

          <div className="grp">
            <H3>Appearance</H3>

            <label className="row">
              <span>Colour</span>
              <HTMLSelect id="k-color" defaultValue="0">
                <option value="0">RGB</option>
                <option value="1">Intensity</option>
                <option value="2">RGB × Intensity</option>
                <option value="3">Elevation</option>
                <option value="4">Normals</option>
                <option value="5" id="k-color-sf" disabled>
                  Scalar field
                </option>
                <option value="6">Flat</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Point size</span>
              <input
                type="range"
                id="k-size"
                min="0.5"
                max="8"
                step="0.1"
                defaultValue="2.0"
              />
              <b className="mono" id="v-size">
                2.0
              </b>
            </label>

            <label className="row">
              <span>Sizing</span>
              <HTMLSelect id="k-sizemode" defaultValue="1">
                <option value="1">Adaptive</option>
                <option value="0">Fixed</option>
              </HTMLSelect>
            </label>

            <Switch
              id="k-round"
              label="Round points"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row flex! w-full items-center justify-between"
            />
          </div>

          <div className="grp">
            <H3>Lighting</H3>

            <Switch
              id="k-edl"
              label="EDL"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row flex! w-full items-center justify-between"
            />

            <label className="row">
              <span>Strength</span>
              <input
                type="range"
                id="k-edlstr"
                min="0"
                max="1.5"
                step="0.01"
                defaultValue="0.32"
              />
              <b className="mono" id="v-edlstr">
                0.32
              </b>
            </label>

            <label className="row">
              <span>Radius</span>
              <input
                type="range"
                id="k-edlrad"
                min="0.5"
                max="5"
                step="0.1"
                defaultValue="1.4"
              />
              <b className="mono" id="v-edlrad">
                1.4
              </b>
            </label>

            <Switch
              id="k-nrm"
              label="Normal shading"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />
          </div>

          <div className="grp">
            <H3>Tone</H3>

            <label className="row">
              <span>Brightness</span>
              <input
                type="range"
                id="k-bright"
                min="0.2"
                max="3"
                step="0.01"
                defaultValue="1"
              />
              <b className="mono" id="v-bright">
                1.00
              </b>
            </label>

            <label className="row">
              <span>Gamma</span>
              <input
                type="range"
                id="k-gamma"
                min="0.4"
                max="2.4"
                step="0.01"
                defaultValue="1"
              />
              <b className="mono" id="v-gamma">
                1.00
              </b>
            </label>

            <div className="row col">
              <span>Intensity range</span>

              <canvas id="hist" width="240" height="42" />

              <div className="dual">
                <input
                  type="range"
                  id="k-imin"
                  min="0"
                  max="1"
                  step="0.005"
                  defaultValue="0"
                />
                <input
                  type="range"
                  id="k-imax"
                  min="0"
                  max="1"
                  step="0.005"
                  defaultValue="1"
                />
              </div>

              <b className="mono" id="v-irange">
                0.00 – 1.00
              </b>
            </div>
          </div>

          <div className="grp">
            <H3>Clipping</H3>

            <label className="row">
              <span>Height min</span>
              <input
                type="range"
                id="k-zmin"
                min="0"
                max="1"
                step="0.005"
                defaultValue="0"
              />
              <b className="mono" id="v-zmin">
                —
              </b>
            </label>

            <label className="row">
              <span>Height max</span>
              <input
                type="range"
                id="k-zmax"
                min="0"
                max="1"
                step="0.005"
                defaultValue="1"
              />
              <b className="mono" id="v-zmax">
                —
              </b>
            </label>
          </div>

          <div className="grp">
            <H3>Performance</H3>

            <label className="row">
              <span>Points per frame</span>
              <HTMLSelect id="k-budget" defaultValue="8000000">
                <option value="1000000">1 M</option>
                <option value="2000000">2 M</option>
                <option value="4000000">4 M</option>
                <option value="8000000">8 M</option>
                <option value="16000000">16 M</option>
                <option value="32000000">32 M</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Density</span>
              <input
                type="range"
                id="k-density"
                min="0.3"
                max="4"
                step="0.05"
                defaultValue="2"
              />
              <b className="mono" id="v-density">
                2.00
              </b>
            </label>

            <label className="row">
              <span>Max point px</span>
              <input
                type="range"
                id="k-maxpx"
                min="2"
                max="24"
                step="0.5"
                defaultValue="7"
              />
              <b className="mono" id="v-maxpx">
                7.0
              </b>
            </label>

            <label className="row">
              <span>While moving</span>
              <input
                type="range"
                id="k-moving"
                min="0.1"
                max="1"
                step="0.05"
                defaultValue="0.35"
              />
              <b className="mono" id="v-moving">
                0.35
              </b>
            </label>

            <p className="statusline" id="v-stats">
              —
            </p>

            <label className="row">
              <span>In memory</span>
              <HTMLSelect id="k-load" defaultValue="1">
                <option value="1">Everything</option>
                <option value="2">1 in 2</option>
                <option value="4">1 in 4</option>
                <option value="10">1 in 10</option>
                <option value="30">1 in 30</option>
              </HTMLSelect>
            </label>

            <p className="statusline" id="v-loaded">
              —
            </p>

            <ButtonGroup fill className="mb-2">
              <Button id="k-undo" size="small" disabled>
                Undo
              </Button>

              <Button id="k-redo" size="small" disabled>
                Redo
              </Button>
            </ButtonGroup>

            <Button
              id="k-save"
              intent={Intent.PRIMARY}
              fill
              size="small"
              disabled
              className="mb-1.5"
            >
              Save as…
            </Button>

            <Button id="k-reload" fill size="small" className="mb-1.5">
              Reload
            </Button>

            <Button id="k-open" fill size="small" className="mb-1.5">
              View from file…
            </Button>

            <p className="hint">
              Undo/redo cover crop and section edits. <b>Save as…</b> writes a copy of the current points to a file you choose, updates the on-device cache if there is one, and clears undo. <b>⌘Z</b> / <b>⇧⌘Z</b> / <b>⌘S</b>. Escape cancels a crop region.
            </p>

            <p className="statusline" id="v-hist">
              —
            </p>
          </div>

          <div className="grp" data-grp="crop">
            <H3>Crop</H3>

            <label className="row">
              <span>Shape</span>
              <HTMLSelect id="k-cropshape" defaultValue="box">
                <option value="box">Box</option>
                <option value="sphere">Sphere</option>
                <option value="slab">Slab</option>
              </HTMLSelect>
            </label>

            <Switch
              id="k-cropon"
              label="Show region"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <ButtonGroup fill className="mb-2">
              <Button id="k-cropkeep" size="small" className="on">
                Keep inside
              </Button>

              <Button id="k-cropdel" size="small">
                Remove inside
              </Button>
            </ButtonGroup>

            <ButtonGroup fill className="mb-2">
              <Button id="k-cropmove" size="small" className="on">
                Move
              </Button>

              <Button id="k-croprotate" size="small">
                Rotate
              </Button>

              <Button id="k-cropresize" size="small">
                Resize
              </Button>
            </ButtonGroup>

            <Switch
              id="k-crophide"
              label="Hide outside"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <label className="row">
              <span>Size</span>
              <input
                type="range"
                id="k-cropsize"
                min="0"
                max="1"
                step="0.002"
                defaultValue="0.35"
              />
              <b className="mono" id="v-cropsize">
                —
              </b>
            </label>

            <label className="row box-only">
              <span>Depth</span>
              <input
                type="range"
                id="k-cropsy"
                min="0"
                max="1"
                step="0.002"
                defaultValue="0.35"
              />
              <b className="mono" id="v-cropsy">
                —
              </b>
            </label>

            <label className="row box-only">
              <span>Height</span>
              <input
                type="range"
                id="k-cropsz"
                min="0"
                max="1"
                step="0.002"
                defaultValue="0.35"
              />
              <b className="mono" id="v-cropsz">
                —
              </b>
            </label>

            <label className="row prism-only">
              <span>Prism depth</span>
              <input
                type="range"
                id="k-prismdepth"
                min="0.004"
                max="1"
                step="0.004"
                defaultValue="1"
              />
              <b className="mono" id="v-prismdepth">
                —
              </b>
            </label>

            <Button id="k-cropcentre" fill size="small" className="mb-1.5">
              Centre on orbit point
            </Button>

            <p className="lab mono">NEW REGION</p>

            <div className="row">
              <span>Shape</span>
              <HTMLSelect id="k-newshape" defaultValue="box">
                <option value="box">Box</option>
                <option value="sphere">Sphere</option>
              </HTMLSelect>
            </div>

            <Button id="k-place" fill size="small" className="mb-1.5">
              Create region (S)
            </Button>

            <ButtonGroup fill className="mb-2 region-active">
              <Button id="k-grow" size="small">
                Grow ×1.5
              </Button>

              <Button id="k-shrink" size="small">
                Shrink ÷1.5
              </Button>
            </ButtonGroup>

            <Button
              id="k-fitcontents"
              fill
              size="small"
              className="mb-1.5 region-active"
            >
              Fit to contents
            </Button>

            <Button id="k-segment" fill size="small" className="mb-1.5">
              Draw an outline… (⇧S)
            </Button>

            <ButtonGroup fill className="mb-2">
              <Button id="k-cropcancel" size="small">
                Cancel region
              </Button>

              <Button id="k-cropapply" intent={Intent.PRIMARY} size="small">
                Apply crop…
              </Button>
            </ButtonGroup>

            <p className="statusline" id="v-crop">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Click <b>Create region</b> then click a point on the cloud: a small shape appears there, ready to resize. <b>Grow</b>, the handles, the size sliders, or <b>Alt</b> + scroll while it is active all enlarge it; <b>Fit to contents</b> grows it until it stops finding new points and then tightens onto them.
              </p>
              <p className="hint">
                Drag the arrows to move, the rings to rotate, the handles to resize. Double-click a point to move the orbit centre, then centre the region there. <b>Keep inside</b> dims everything outside the region; <b>Remove inside</b> dims what is inside it — either way the preview is what Apply will leave behind. <b>Escape</b> cancels the region.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="sections">
            <H3>Sections</H3>

            <Button id="k-secadd" fill size="small" className="mb-1.5">
              Add section at orbit point
            </Button>

            <ul id="sec-list" className="mlist" />

            <p className="statusline" id="v-sections">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Bounding shapes, combined as a union: keep only what lies inside any of them, or mark one <b>Remove</b> to drop what is inside it. A section is a slab you move, tilt and thicken with the gizmo — floors, a wall, a corridor. A drawn region (<b>S</b>) is an outline extruded along the direction you drew it from, so you can orbit around it and see exactly what it holds.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="clean">
            <H3>Clean</H3>

            <label className="row">
              <span title="How many nearest points each measurement looks at.">
                Neighbours
              </span>
              <input
                type="range"
                id="k-ank2"
                min="3"
                max="64"
                step="1"
                defaultValue="16"
              />
              <b className="mono" id="v-ank2">
                16
              </b>
            </label>

            <label className="row">
              <span title="How many standard deviations from the mean a point may be before it is dropped.">
                Strictness
              </span>
              <input
                type="range"
                id="k-ansigma"
                min="0.5"
                max="4"
                step="0.1"
                defaultValue="1.0"
              />
              <b className="mono" id="v-ansigma">
                1.0 σ
              </b>
            </label>

            <Button
              id="k-ansor"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Remove outliers…
            </Button>

            <Button id="k-annoise" fill size="small" className="mb-1.5">
              Remove noise…
            </Button>

            <details className="sub">
              <summary>Noise filter options</summary>

              <label className="row">
                <span title="CloudCompare calls this the neighbours option. A sphere is its default.">
                  Neighbourhood
                </span>
                <HTMLSelect id="k-annbmode" defaultValue="radius">
                  <option value="radius">Sphere of a radius</option>
                  <option value="knn">Nearest neighbours</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Radius</span>
                <input
                  type="range"
                  id="k-annradius"
                  min="0.01"
                  max="2"
                  step="0.01"
                  defaultValue="0.15"
                />
                <b className="mono" id="v-annradius">
                  0.15 m
                </b>
              </label>

              <label className="row">
                <span title="CloudCompare calls this the error option. Relative is its default.">
                  Threshold
                </span>
                <HTMLSelect id="k-anerrmode" defaultValue="relative">
                  <option value="relative">Relative, in sigma</option>
                  <option value="absolute">Absolute distance</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Absolute</span>
                <input
                  type="range"
                  id="k-annabs"
                  min="0.001"
                  max="0.5"
                  step="0.001"
                  defaultValue="0.02"
                />
                <b className="mono" id="v-annabs">
                  0.020 m
                </b>
              </label>

              <Switch
                id="k-annrip"
                label="Remove isolated points"
                alignIndicator={Alignment.END}
                className="row flex! w-full items-center justify-between"
              />
            </details>

            <Button id="k-andup" fill size="small" className="mb-1.5">
              Remove duplicates…
            </Button>

            <p className="statusline" id="v-clean">
              —
            </p>

            <p className="hint">
              CloudCompare&apos;s SOR and noise filters, same settings, same points removed.
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                <b>Remove outliers</b> measures each point&apos;s mean distance to its neighbours and drops the ones beyond the mean plus <b>Strictness</b> standard deviations, judged over the whole cloud. A few very distant points can push that threshold out past the real outliers, so crop a stray reflection away first.
              </p>
              <p className="hint">
                <b>Remove noise</b> fits a plane to the points around each point and drops it if it sits further off that plane than its own neighbours&apos; spread allows. The threshold is local, so a smooth wall is judged strictly and a hedge loosely. Real edges survive because they still fit a plane.
              </p>
              <p className="hint">Every removal is one undoable step.</p>
            </details>
          </div>

          <div className="grp" data-grp="transform">
            <H3>Transform</H3>

            <p className="statusline" id="v-transform">
              no transform
            </p>

            <p className="lab mono">TRANSLATE</p>

            <div className="trio">
              <input
                type="number"
                id="k-tx"
                step="0.1"
                defaultValue="0"
                aria-label="East / X metres"
              />
              <input
                type="number"
                id="k-ty"
                step="0.1"
                defaultValue="0"
                aria-label="North / Y metres"
              />
              <input
                type="number"
                id="k-tz"
                step="0.1"
                defaultValue="0"
                aria-label="Up / Z metres"
              />
            </div>

            <Button id="k-tmove" fill size="small" className="mb-1.5">
              Move by these metres
            </Button>

            <p className="lab mono">ROTATE</p>

            <div className="row">
              <span>Axis</span>
              <HTMLSelect id="k-taxis" defaultValue="z">
                <option value="z">Z (plan)</option>
                <option value="x">X</option>
                <option value="y">Y</option>
              </HTMLSelect>
            </div>

            <div className="row">
              <span>Degrees</span>
              <input
                type="number"
                id="k-tdeg"
                step="0.5"
                defaultValue="90"
                aria-label="degrees"
              />
            </div>

            <div className="row">
              <span>About</span>
              <HTMLSelect id="k-tabout" defaultValue="centre">
                <option value="centre">Bounding-box centre</option>
                <option value="origin">Origin</option>
              </HTMLSelect>
            </div>

            <Button id="k-trot" fill size="small" className="mb-1.5">
              Rotate
            </Button>

            <p className="lab mono">SCALE</p>

            <div className="row">
              <span>Factor</span>
              <input
                type="number"
                id="k-tscale"
                step="0.01"
                defaultValue="1"
                aria-label="uniform scale factor"
              />
            </div>

            <Button id="k-tscalego" fill size="small" className="mb-1.5">
              Scale about the centre
            </Button>

            <p className="lab mono">FIT</p>

            <Button id="k-tlevel" fill size="small" className="mb-1.5">
              Level (make horizontal)
            </Button>

            <Button id="k-tcentre" fill size="small" className="mb-1.5">
              Move centre to origin
            </Button>

            <Button id="k-tmincorner" fill size="small" className="mb-1.5">
              Move min corner to origin
            </Button>

            <p className="lab mono">BY HAND</p>

            <Switch
              id="k-tdrag"
              label="Drag to move/rotate"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <ButtonGroup fill className="mb-2">
              <Button id="k-tmodemove" size="small" className="on">
                Move
              </Button>

              <Button id="k-tmoderotate" size="small">
                Rotate
              </Button>

              <Button id="k-tmodescale" size="small">
                Scale
              </Button>
            </ButtonGroup>

            <ButtonGroup fill className="mb-2">
              <Button id="k-tmatrix" size="small">
                Apply matrix…
              </Button>

              <Button id="k-treset" size="small">
                Reset
              </Button>
            </ButtonGroup>

            <p className="lab mono">GLOBAL SHIFT</p>

            <p className="statusline" id="v-shift">
              —
            </p>

            <Button id="k-tshift" fill size="small" className="mb-1.5">
              Edit global shift…
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Moves the whole cloud without touching a point. The records stay exactly as they are and a 4&times;4 matrix is applied when they are drawn, tested, analysed and exported — instant, lossless and undoable. <b>Save a copy</b> bakes it into the file.
              </p>
              <p className="hint">
                The gizmo grabs the whole cloud at its bounding-box centre. It shares the handles with the crop region, so turning it on releases the crop gizmo and vice versa. One undo step per drag.
              </p>
              <p className="hint">
                The scan&apos;s own pose offset, added back on export and shown in the coordinate readout. It is not part of the transform above and moves nothing on screen.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="analysis">
            <H3>Analysis</H3>

            <label className="row">
              <span title="How many nearest points each measurement looks at. Larger is smoother and slower.">
                Neighbours
              </span>
              <input
                type="range"
                id="k-ank"
                min="6"
                max="64"
                step="1"
                defaultValue="16"
              />
              <b className="mono" id="v-ank">
                16
              </b>
            </label>

            <p className="lab mono">NORMALS</p>

            <ButtonGroup fill className="mb-2">
              <Button id="k-annorm" size="small">
                Compute
              </Button>

              <Button id="k-anorient" size="small">
                Orient
              </Button>

              <Button id="k-aninvert" size="small">
                Invert
              </Button>
            </ButtonGroup>

            <p className="hint">
              Reconstruction and shading both need normals. <b>Orient</b> turns them toward the scanner stations.
            </p>

            <p className="lab mono">MEASURE</p>

            <label className="row">
              <span>Feature</span>
              <HTMLSelect id="k-anfeat" defaultValue="roughness">
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
              </HTMLSelect>
            </label>

            <Button id="k-anfeatgo" fill size="small" className="mb-1.5">
              Compute feature
            </Button>

            <p className="lab mono">CLUSTER AND THIN</p>

            <label className="row">
              <span>Spacing</span>
              <input
                type="range"
                id="k-anspace"
                min="0.01"
                max="2"
                step="0.01"
                defaultValue="0.1"
              />
              <b className="mono" id="v-anspace">
                0.10 m
              </b>
            </label>

            <ButtonGroup fill className="mb-2">
              <Button id="k-ancc" size="small">
                Components
              </Button>

              <Button id="k-ansub" size="small">
                Thin…
              </Button>
            </ButtonGroup>

            <p className="hint">
              <b>Components</b> labels groups of points that touch within the spacing. <b>Thin</b> keeps one point per cube of that size.
            </p>

            <p className="statusline" id="v-analysis">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                A feature is one number per point, computed from the shape of its neighbourhood and written as a scalar field. Colour by it with <b>Colour → Scalar field</b>, or narrow the range to isolate part of the cloud.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="raster">
            <H3>Raster</H3>

            <label className="row">
              <span>Cell size</span>
              <input
                type="range"
                id="k-rcell"
                min="0.01"
                max="2"
                step="0.01"
                defaultValue="0.25"
              />
              <b className="mono" id="v-rcell">
                0.25 m
              </b>
            </label>

            <label className="row">
              <span>Value</span>
              <HTMLSelect id="k-rstat" defaultValue="max">
                <option value="max">Highest point</option>
                <option value="min">Lowest point</option>
                <option value="mean">Mean height</option>
                <option value="density">Points per cell</option>
                <option value="field">Mean scalar field</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Along</span>
              <HTMLSelect id="k-raxis" defaultValue="z">
                <option value="z">Z (a height model)</option>
                <option value="x">X</option>
                <option value="y">Y</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Fill empty cells</span>
              <HTMLSelect id="k-rfill" defaultValue="none">
                <option value="none">Leave empty</option>
                <option value="nearest">Nearest</option>
                <option value="idw">Inverse distance</option>
              </HTMLSelect>
            </label>

            <Button
              id="k-rasterize"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Rasterize
            </Button>

            <p className="statusline" id="v-raster">
              —
            </p>

            <Switch
              id="k-rshow"
              label="Show the draped grid"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row raster-have w-full items-center justify-between"
            />

            <Button
              id="k-rsavepng"
              fill
              size="small"
              className="mb-1.5 raster-have"
            >
              Save PNG + world file…
            </Button>

            <p className="lab mono">CONTOURS</p>

            <label className="row">
              <span>Interval</span>
              <input
                type="range"
                id="k-cint"
                min="0.05"
                max="5"
                step="0.05"
                defaultValue="0.5"
              />
              <b className="mono" id="v-cint">
                0.50 m
              </b>
            </label>

            <Button id="k-contours" fill size="small" className="mb-1.5">
              Draw contours
            </Button>

            <ButtonGroup fill className="mb-2 contour-have">
              <Button id="k-cdxf" size="small">
                Save DXF…
              </Button>

              <Button id="k-cgeojson" size="small">
                Save GeoJSON…
              </Button>
            </ButtonGroup>

            <p className="statusline" id="v-contours">
              —
            </p>

            <p className="lab mono">VOLUME</p>

            <label className="row">
              <span>Against</span>
              <HTMLSelect id="k-vref" />
            </label>

            <label className="row">
              <span>Plane height</span>
              <input type="number" id="k-vplane" step="0.1" defaultValue="0" />
            </label>

            <Button id="k-volume" fill size="small" className="mb-1.5">
              Measure the volume
            </Button>

            <p className="statusline" id="v-volume">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                A 2.5D volume: the difference between two height rasters over the same cells, one cell area at a time. Cut and fill are reported separately because their sum hides both.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="fit">
            <H3>Fit</H3>

            <ButtonGroup fill className="mb-2">
              <Button id="k-fitplane" size="small">
                Plane
              </Button>

              <Button id="k-fitsphere" size="small">
                Sphere
              </Button>
            </ButtonGroup>

            <ButtonGroup fill className="mb-2">
              <Button id="k-fitcyl" size="small">
                Cylinder
              </Button>

              <Button id="k-fitcircle" size="small">
                Circle
              </Button>
            </ButtonGroup>

            <p className="statusline" id="v-fit">
              —
            </p>

            <Button id="k-fitclear" fill size="small" className="mb-1.5">
              Clear the drawn shape
            </Button>

            <p className="lab mono">DETECT</p>

            <label className="row">
              <span title="How far a point may be from a shape and still count as part of it.">
                Tolerance
              </span>
              <input
                type="range"
                id="k-dettol"
                min="0.002"
                max="0.2"
                step="0.002"
                defaultValue="0.02"
              />
              <b className="mono" id="v-dettol">
                0.02 m
              </b>
            </label>

            <label className="row">
              <span>Min points</span>
              <input
                type="range"
                id="k-detmin"
                min="100"
                max="20000"
                step="100"
                defaultValue="2000"
              />
              <b className="mono" id="v-detmin">
                2,000
              </b>
            </label>

            <label className="row">
              <span>Look for</span>
              <HTMLSelect id="k-detkinds" defaultValue="plane,sphere,cylinder">
                <option value="plane">Planes</option>
                <option value="plane,cylinder">Planes and cylinders</option>
                <option value="plane,sphere,cylinder">
                  Planes, spheres, cylinders
                </option>
              </HTMLSelect>
            </label>

            <Button
              id="k-detect"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Detect shapes…
            </Button>

            <ul id="det-list" className="mlist" />

            <ButtonGroup fill className="mb-2 det-have">
              <Button id="k-detkeep" size="small">
                Keep only inliers
              </Button>

              <Button id="k-detremove" size="small">
                Remove inliers
              </Button>
            </ButtonGroup>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Fits a primitive to the <b>active region&apos;s contents</b>, or to the whole layer when no region is active. The RMS is the number that says whether to believe it.
              </p>
            </details>
          </div>

          <div className="grp sf-have" data-grp="field">
            <H3>Scalar field</H3>

            <p className="statusline" id="v-sfname">
              no field
            </p>

            <canvas id="sf-hist" height="52" />

            <label className="row">
              <span>Display from</span>
              <input
                type="range"
                id="k-sfmin"
                min="0"
                max="1000"
                step="1"
                defaultValue="0"
              />
              <b className="mono" id="v-sfmin">
                —
              </b>
            </label>

            <label className="row">
              <span>to</span>
              <input
                type="range"
                id="k-sfmax"
                min="0"
                max="1000"
                step="1"
                defaultValue="1000"
              />
              <b className="mono" id="v-sfmax">
                —
              </b>
            </label>

            <Button id="k-sfauto" fill size="small" className="mb-1.5">
              Auto range (2–98%)
            </Button>

            <Switch
              id="k-sffilter"
              label="Filter points"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <label className="row sf-filtering">
              <span>Keep from</span>
              <input
                type="range"
                id="k-sflo"
                min="0"
                max="1000"
                step="1"
                defaultValue="0"
              />
              <b className="mono" id="v-sflo">
                —
              </b>
            </label>

            <label className="row sf-filtering">
              <span>to</span>
              <input
                type="range"
                id="k-sfhi"
                min="0"
                max="1000"
                step="1"
                defaultValue="1000"
              />
              <b className="mono" id="v-sfhi">
                —
              </b>
            </label>

            <Switch
              id="k-sfhide"
              label="Hide the rest"
              alignIndicator={Alignment.END}
              className="row sf-filtering w-full items-center justify-between"
            />

            <Button
              id="k-sfapply"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5 sf-filtering"
            >
              Delete points outside…
            </Button>

            <Button id="k-sfclear" fill size="small" className="mb-1.5">
              Clear field
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                A field is one number per point. Colour by it with <b>Colour → Scalar field</b>, narrow the display range to see detail, or filter to keep only part of the cloud.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="mesh">
            <H3>Mesh</H3>

            <label className="row">
              <span>Detail</span>
              <input
                type="range"
                id="k-mvox"
                min="0.5"
                max="60"
                step="0.5"
                defaultValue="6"
              />
              <b className="mono" id="v-mvox">
                6 cm
              </b>
            </label>

            <label className="row">
              <span>Smoothing</span>
              <input
                type="range"
                id="k-msmooth"
                min="0"
                max="6"
                step="1"
                defaultValue="2"
              />
              <b className="mono" id="v-msmooth">
                2
              </b>
            </label>

            <label className="row">
              <span>Fill gaps</span>
              <input
                type="range"
                id="k-mtrunc"
                min="1"
                max="4"
                step="0.5"
                defaultValue="2"
              />
              <b className="mono" id="v-mtrunc">
                2.0
              </b>
            </label>

            <Button
              id="k-mbuild"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Build from points…
            </Button>

            <p className="statusline" id="v-mesh">
              —
            </p>

            <p className="lab mono">SHOW</p>

            <ButtonGroup fill className="mb-2">
              <Button id="k-disppoints" size="small" className="on">
                Points
              </Button>

              <Button id="k-dispmesh" size="small">
                Mesh
              </Button>

              <Button id="k-dispboth" size="small">
                Both
              </Button>
            </ButtonGroup>

            <Switch
              id="k-mflat"
              label="Flat shading"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <p className="lab mono mesh-have">EDIT</p>

            <ButtonGroup fill className="mb-2 mesh-have">
              <Button id="k-meshflip" size="small">
                Flip
              </Button>

              <Button id="k-meshsmooth" size="small">
                Smooth
              </Button>

              <Button id="k-meshdecim" size="small">
                Decimate
              </Button>
            </ButtonGroup>

            <label className="row mesh-have">
              <span>Smooth passes</span>
              <input
                type="range"
                id="k-meshiter"
                min="1"
                max="20"
                step="1"
                defaultValue="5"
              />
              <b className="mono" id="v-meshiter">
                5
              </b>
            </label>

            <Switch
              id="k-meshtaubin"
              label="Keep volume"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row mesh-have w-full items-center justify-between"
            />

            <label className="row mesh-have">
              <span>Decimate to</span>
              <input
                type="range"
                id="k-meshcell"
                min="0.5"
                max="100"
                step="0.5"
                defaultValue="10"
              />
              <b className="mono" id="v-meshcell">
                10 cm
              </b>
            </label>

            <p className="lab mono mesh-have">MEASURE</p>

            <Button
              id="k-meshmeasure"
              fill
              size="small"
              className="mb-1.5 mesh-have"
            >
              Area and volume
            </Button>

            <p className="lab mono mesh-have">COMPARE</p>

            <label className="row mesh-have">
              <span>Distance to</span>
              <HTMLSelect id="k-meshref" />
            </label>

            <Switch
              id="k-meshsigned"
              label="Signed"
              alignIndicator={Alignment.END}
              className="row mesh-have w-full items-center justify-between"
            />

            <Button
              id="k-meshdist"
              fill
              size="small"
              className="mb-1.5 mesh-have"
            >
              Distance from this cloud
            </Button>

            <p className="lab mono mesh-have">SAMPLE</p>

            <label className="row mesh-have">
              <span>Sample</span>
              <HTMLSelect id="k-meshsmode" defaultValue="count">
                <option value="count">points in all</option>
                <option value="density">points per m²</option>
              </HTMLSelect>
            </label>

            <label className="row mesh-have">
              <span>How many</span>
              <input
                type="number"
                id="k-meshsval"
                min="100"
                step="1000"
                defaultValue="200000"
              />
            </label>

            <Button
              id="k-meshsample"
              fill
              size="small"
              className="mb-1.5 mesh-have"
            >
              Sample to a new layer
            </Button>

            <label className="row mesh-have">
              <span>Format</span>
              <HTMLSelect id="k-meshfmt" defaultValue="ply">
                <option value="ply">PLY (binary)</option>
                <option value="obj">OBJ</option>
                <option value="stl">STL (binary)</option>
              </HTMLSelect>
            </label>

            <Button
              id="k-meshsave"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5 mesh-have"
            >
              Export mesh…
            </Button>

            <Button id="k-mclear" fill size="small" className="mb-1.5 mesh-have">
              Discard mesh
            </Button>

            <p className="statusline" id="v-meshinfo">
              no mesh yet
            </p>

            <Button id="k-meshopen" fill size="small" className="mb-1.5">
              Import a mesh…
            </Button>

            <p className="hint">
              Opens a PLY, OBJ or STL as a layer of its own, to compare against or edit.
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                <b>Build from points</b> is surface reconstruction: it needs normals, and writes a triangle mesh as a separate object that you can show, hide, measure or export. <b>Detail</b> is the voxel size, so smaller is finer and slower, and below the scan&apos;s own point spacing it only adds noise. <b>Fill gaps</b> widens the band each point writes, closing small holes at the cost of rounding sharp edges.
              </p>
              <p className="hint">
                <b>Area</b> and <b>volume</b> are measured through the layer&apos;s transform. A volume only means anything when the mesh is closed, so the boundary edge count is reported next to it. <b>Smooth</b> is Taubin with Keep volume on and plain Laplacian with it off. <b>Decimate</b> is vertex clustering at the cell you set, which is fast but cannot hit an exact triangle count.
              </p>
              <p className="hint">
                <b>Distance from this cloud</b> measures every point of the active point layer to the nearest triangle of the mesh layer you pick, and writes it as a scalar field.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="measure">
            <H3>Measure</H3>

            <ButtonGroup fill className="mb-2">
              <Button id="k-measure" size="small">
                Distance
              </Button>

              <Button id="k-measureclear" size="small">
                Clear
              </Button>
            </ButtonGroup>

            <p className="hint">
              Click two points. <b>M</b> toggles. Single-click anywhere shows coordinates.
            </p>

            <ul id="measure-list" className="mlist mono" />
          </div>

          <div className="grp" data-grp="export">
            <H3>Export</H3>

            <label className="row">
              <span>Format</span>
              <HTMLSelect id="k-fmt" defaultValue="e57">
                <option value="e57">E57</option>
                <option value="las">LAS 1.2</option>
                <option value="laz">LAZ (compressed)</option>
                <option value="ply">PLY (binary)</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Keep</span>
              <HTMLSelect id="k-expstride" defaultValue="1">
                <option value="1">Every point</option>
                <option value="2">1 in 2</option>
                <option value="4">1 in 4</option>
                <option value="10">1 in 10</option>
              </HTMLSelect>
            </label>

            <Button
              id="k-export"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Save a copy…
            </Button>

            <p className="statusline" id="v-export">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Writes what is in memory — the crop, if you applied one. The original file is never touched.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="stations">
            <H3>Stations</H3>

            <Switch
              id="k-stations"
              label="Show stations"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row flex! w-full items-center justify-between"
            />

            <p className="statusline" id="v-stations">
              —
            </p>

            <div id="bubble-ui" className="hidden">
              <label className="row">
                <span>Points over photo</span>
                <input
                  type="range"
                  id="k-blend"
                  min="0"
                  max="1"
                  step="0.01"
                  defaultValue="0.35"
                />
                <b className="mono" id="v-blend">
                  0.35
                </b>
              </label>

              <Button id="k-bubble-exit" fill size="small" className="mb-1.5">
                Leave photo
              </Button>
            </div>

            <p className="hint">
              Click a station marker to look around its 360° photo. Walk away and it fades.
            </p>
          </div>

          <div className="grp" data-grp="cache">
            <H3>Cache</H3>

            <p className="statusline" id="v-cache">
              —
            </p>

            <Button id="k-cache" fill size="small" className="mb-1.5">
              Cache this scan on this device
            </Button>

            <Button
              id="k-cacheremove"
              fill
              size="small"
              className="mb-1.5 hidden"
            >
              Remove from cache
            </Button>

            <Button id="k-viewlink" fill size="small" className="mb-1.5">
              Copy view link
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Writes decoded cells on this device so the next open is instant. <b>Save</b> (in Performance) also updates this cache after a crop, and clears undo.
              </p>
            </details>
          </div>

          <div className="grp">
            <H3>View</H3>

            <ButtonGroup fill className="mb-2">
              <Button id="k-orbit" size="small" className="on">
                Orbit
              </Button>

              <Button id="k-fly" size="small">
                Fly
              </Button>
            </ButtonGroup>

            <label className="row">
              <span>Fly speed</span>
              <input
                type="range"
                id="k-flyspeed"
                min="0.1"
                max="30"
                step="0.1"
                defaultValue="2"
              />
              <b className="mono" id="v-flyspeed">
                2.0
              </b>
            </label>

            <Button id="k-top" fill size="small" className="mb-1.5">
              Top down
            </Button>

            <Button id="k-fit" fill size="small" className="mb-1.5">
              Fit to cloud
            </Button>

            <p className="hint" id="v-navhint">
              Drag to orbit · scroll zooms toward the cursor · <b>double-click</b> a point to orbit around it
            </p>
          </div>
        </Card>

        <ButtonGroup id="toolbar" className="hidden">
          <Button data-tool="orbit" size="small" className="on">
            Orbit
          </Button>

          <Button data-tool="fly" size="small">
            Fly
          </Button>

          <Button data-tool="measure" size="small">
            Measure
          </Button>

          <Button data-tool="segment" size="small">
            Region
          </Button>

          <Button data-tool="crop" size="small">
            Crop
          </Button>

          <Button data-tool="photo" size="small" className="hidden">
            Leave photo
          </Button>
        </ButtonGroup>

        <div id="joy" className="hidden">
          <div className="pad">
            <Button data-key="w" className="up">
              ▲
            </Button>

            <Button data-key="a" className="left">
              ◀
            </Button>

            <Button data-key="d" className="right">
              ▶
            </Button>

            <Button data-key="s" className="down">
              ▼
            </Button>
          </div>

          <div className="vert">
            <Button data-key="e">up</Button>
            <Button data-key="q">down</Button>
          </div>
        </div>

        <svg id="seg" className="hidden">
          <polygon id="seg-fill" />
          <polyline id="seg-line" />
        </svg>

        <Card id="placebar" elevation={2} className="hidden">
          <Text className="mono" id="place-hint">
            Click a point to place a region · Esc cancels
          </Text>

          <Button id="place-cancel" size="small">
            Cancel
          </Button>
        </Card>

        <Card id="segbar" elevation={2} className="hidden">
          <Text className="mono" id="seg-hint">
            Click to trace a shape · double-click to close · Esc to cancel
          </Text>

          <Button id="seg-region" intent={Intent.PRIMARY} size="small" disabled>
            Create region
          </Button>

          <Button id="seg-in" size="small" disabled>
            Keep inside now
          </Button>

          <Button id="seg-out" size="small" disabled>
            Remove inside now
          </Button>

          <Button id="seg-cancel" size="small">
            Cancel
          </Button>
        </Card>

        <div id="coord" className="mono hidden" />
        <div id="labels" />

        <div id="modal" className="hidden">
          <Card elevation={4} className="card">
            <H2 id="modal-title" />
            <div id="modal-body" />
            <div className="btns" id="modal-btns" />
          </Card>
        </div>

        <div id="busy" className="hidden">
          <Card elevation={4} className="card">
            <Text id="busy-text">Working…</Text>

            <div className="bar">
              <i id="busy-bar" />
            </div>

            <Button id="busy-stop" fill size="small" className="mt-2.5 hidden">
              Cancel
            </Button>
          </Card>
        </div>

        <div id="err" className="hidden" />
      </div>
    </div>
  )
}
