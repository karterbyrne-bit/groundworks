/* ================= data ================= */
const SPORTS = {
  football:{W:105,H:68,r:0,set:8,flag:[52.5,34],note:"105 × 68 m pitch, the size used at most top-flight grounds."},
  rugby:{W:120,H:70,r:0,set:6,flag:[50,35],note:"100 × 70 m field plus 10 m in-goal at each end."},
  cricket:{W:150,H:136,r:62,set:6,noStands:true,note:"Oval with roughly 70 m boundaries. Cricket grounds are bowls, often with a pavilion on top."},
  athletics:{W:177,H:92.6,r:46.3,set:4,noStands:true,note:"400 m, eight-lane track wrapped around a football pitch."},
  baseball:{W:105,H:105,r:0,set:10,home:[-52.5,-52.5],standsOnly:true,note:"Home plate sits in the Main / West corner. Foul lines run along the Main and West stands; the outfield bleachers are the Opposite and East stands."},
  custom:{set:3,note:""}
};
const KINDS = {
  wrestleball:{label:"Wrestleball", W:16.5,H:4.5,r:0,surface:"grass",set:2.5,floor:0,zones:[4,8.5,4],outdoor:true,note:"An outdoor sport on grass: 16.5 × 4.5 m, with two 4 m end zones either side of an 8.5 m central playing area."},
  boxing:{label:"Boxing", W:7.3,H:7.3,r:0,surface:"arena",set:3,focusY:1.2,floor:6,note:"A 6.1 m (20 ft) ring inside the ropes on a 1.2 m-high platform, with ringside floor seats."},
  cage:{label:"MMA cage", W:9.1,H:9.1,r:2.66,surface:"arena",set:3,focusY:0.9,floor:6,note:"A 9.1 m (30 ft) octagon on a 0.9 m stage, with ringside floor seats."},
  basketball:{label:"Basketball", W:28,H:15,r:0,surface:"court",set:3,floor:3,note:"28 × 15 m court with courtside seats."},
  hockey:{label:"Ice hockey", W:61,H:30,r:8.5,surface:"ice",set:4,floor:0,note:"61 × 30 m rink with boards and glass."},
  tennis:{label:"Tennis", W:36.6,H:18.3,r:0,surface:"tennis",set:4,floor:0,note:"Doubles court with the run-off a show court needs."},
  concert:{label:"Concert", W:60,H:40,r:0,surface:"arena",set:3,floor:0,note:"A standing floor with a stage at the west end."},
  bullring:{label:"Bullring", W:50,H:50,r:25,surface:"sand",set:2,floor:0,note:"A round sand arena, 50 m across."},
  plain:{label:"Plain floor", W:100,H:64,r:0,surface:"grass",set:4,floor:0,note:"Any floor up to 400 × 300 m. Set the exact size below."}
};
const TYPES = {
  seated:{label:"Seats", short:"seats", eye:1.2, seat:true},
  exec:{label:"Executive boxes", short:"executive", eye:1.2, seat:true},
  rail:{label:"Rail seats (safe standing)", short:"rail seats", eye:1.6, seat:true},
  bench:{label:"Bench / bleachers", short:"bench", eye:1.2, seat:true},
  terrace:{label:"Terrace (standing)", short:"standing", eye:1.6, seat:false}
};
const TYPE_FIELDS = {
  seated:[["row","Row depth","m",0.6,1.0,0.01],["width","Seat width","m",0.4,0.6,0.01]],
  exec:[["row","Row depth","m",0.8,1.4,0.01],["width","Seat width","m",0.45,0.8,0.01]],
  rail:[["row","Row depth","m",0.6,1.0,0.01],["width","Space per person","m",0.4,0.6,0.01]],
  bench:[["row","Row depth","m",0.55,0.9,0.01],["width","Space per person","m",0.38,0.55,0.01]],
  terrace:[["row","Step depth","m",0.28,0.55,0.01],["density","People per m²","",2,7,0.1]]
};
const STANDARDS = {
  recommended:{seatRake:34,terraceRake:25,minRow:0.8,minWidth:0.5,maxBetween:28,minGang:1.1,maxDensity:4.7,barrierGap:5,minC:90,maxView:190,flow:66,maxEvac:8},
  minimum:{seatRake:34,terraceRake:25,minRow:0.7,minWidth:0.46,maxBetween:28,minGang:1.1,maxDensity:4.7,barrierGap:5,minC:60,maxView:190,flow:66,maxEvac:8}
};
const LIMIT_FIELDS = [
  ["seatRake","Max steepness, seats","°",1],["terraceRake","Max steepness, terraces","°",1],
  ["minRow","Min seated row depth","m",0.01],["minWidth","Min seat width","m",0.01],
  ["maxBetween","Max seats between gangways","",1],["minGang","Min gangway width","m",0.05],
  ["maxDensity","Max standing density","/m²",0.1],["barrierGap","Max gap between barriers","m",0.1],
  ["minC","Min sightline (C-value)","mm",5],["maxView","Max viewing distance","m",5],
  ["flow","Exit flow rate","/m/min",1],["maxEvac","Max time to empty a stand","min",0.5]
];
const ROOF_SHAPES = {none:"No roof", slope:"Flat or sloping", gable:"Pitched, with a gable", closed:"Closed over the floor"};
const ROOF_MATS = {translucent:"Translucent", metal:"Metal sheet", concrete:"Concrete", green:"Painted tin", glass:"Glass"};
const ROOF_SUPPORTS = {none:"Hidden cantilever", ribs:"Exposed ribs", columns:"Pillars at the front", truss:"Goalpost truss", masts:"Masts and cables"};
const ROOF_MAT_KEY = {translucent:"roof", metal:"roofSolid", concrete:"roofConcrete", green:"roofGreen", glass:"roofGlass"};
const R = (shape, o) => Object.assign({shape, reach:1.5, lift:6, tilt:4, curve:0, mat:"translucent", support:"none", opening:0}, o || {});
/* A tier: what's in it, how many rows, how steep, and (for tiers above the first) how far it projects over the one below and how high it sits. */
const t = (type, rows, rake, auto, extra) => {
  const o = Object.assign({type, rows, rake, auto: auto !== false, over:0, gap:3, pillars:false}, extra || {});
  if (o.over > 0.5 && o.gap < 4) o.gap = 4;   // leave headroom over the back rows of the tier below
  return o;
};

/* Architectural styles. Each one sets real geometry (tier stack, overhangs, roof form and structure) as well as materials and façade. */
const STYLES = {
  pavilion:{label:"Victorian pavilion", era:"Traditional", clad:0xece6d6, look:"timber", wall:"clad", facade:{gates:true}, lattice:true,
    tiers:() => [t("bench",8,18,false), t("seated",5,22,false,{over:1.5,gap:3.2,pillars:true})],
    roof:() => R("gable",{mat:"green",lift:2.5,reach:0.5,support:"columns"}),
    note:"Cream timber, benches and a members' balcony under a green pitched roof with a gable."},
  edwardian:{label:"Edwardian stand", era:"Traditional", clad:0x9a4a3a, look:"brick", wall:"clad", facade:{gates:true},
    tiers:() => [t("seated",16,18,false)],
    roof:() => R("gable",{mat:"metal",lift:3,reach:-1,support:"columns"}),
    note:"A single long tier under a pitched roof held up by a row of slim pillars."},
  historic:{label:"Leitch double-decker", era:"Traditional", clad:0x8b4636, look:"brick", wall:"clad", facade:{gates:true}, lattice:true,
    tiers:() => [t("seated",14,16,false), t("seated",12,22,false,{over:3,gap:3.4,pillars:true})],
    roof:() => R("gable",{mat:"metal",lift:2.5,reach:0,support:"columns"}),
    note:"Archibald Leitch-style: a shallow lower paddock, an upper deck with the criss-cross balcony truss, brick and pillars. Expect restricted views."},
  brickmain:{label:"Brick-and-steel main stand", era:"Traditional", clad:0x7d3b2c, look:"brick", wall:"clad", facade:{gates:true, towers:true},
    tiers:() => [t("seated",18,20), t("exec",3,22,true,{over:0,gap:3.2})],
    roof:() => R("slope",{mat:"metal",lift:4,reach:0,tilt:2,support:"columns"}),
    note:"A traditional main stand: brick front, directors' boxes at the back, a steel roof on pillars."},
  interwar:{label:"Interwar concrete", era:"Traditional", clad:0xc9c3b3, look:"deco", wall:"clad", facade:{mullions:true, gates:true},
    tiers:() => [t("seated",20,20)],
    roof:() => R("slope",{mat:"concrete",lift:4,reach:-2,tilt:0,support:"columns"}),
    note:"Pale concrete, tall window mullions and a heavy flat roof."},
  terrace:{label:"Covered terrace", era:"Traditional", clad:0x8d918a, look:"sheet", wall:"clad", facade:{},
    tiers:() => [t("terrace",26,20,false)],
    roof:() => R("slope",{mat:"metal",lift:3.5,reach:-6,tilt:0,support:"columns"}),
    note:"A traditional single-tier standing terrace under a simple tin roof on pillars."},
  kop:{label:"Giant open Kop", era:"Traditional", clad:0x9a9a90, look:"plain", wall:"clad", facade:{},
    tiers:() => [t("terrace",60,22,false)],
    roof:() => R("none"),
    note:"One enormous open bank of standing terrace with crush barriers, like the old Spion Kops."},
  extended:{label:"Old terrace, later seats", era:"Traditional", clad:0x7a6a58, look:"brick", wall:"clad", facade:{gates:true},
    tiers:() => [t("terrace",14,18,false), t("seated",14,24,true,{over:2,gap:3.6})],
    roof:() => R("slope",{mat:"metal",lift:4,reach:-3,support:"columns"}),
    note:"The original standing terrace kept at the front, with a newer seated deck bolted on above."},
  brutalist:{label:"1970s brutalist", era:"1970s–90s", clad:0x9d9a92, look:"concrete", wall:"clad", facade:{towers:true},
    tiers:() => [t("seated",20,20), t("seated",14,26,true,{over:4,gap:4.2})],
    roof:() => R("slope",{mat:"concrete",lift:4,reach:-4,tilt:0}),
    note:"Raw concrete massing, exposed stair towers and a heavy concrete cantilever."},
  concretedeck:{label:"Concrete upper deck", era:"1970s–90s", clad:0xa4a097, look:"concrete", wall:"clad", facade:{towers:true},
    tiers:() => [t("seated",16,20), t("seated",18,26,true,{over:6,gap:5,pillars:true})],
    roof:() => R("slope",{mat:"concrete",lift:4,reach:-2,tilt:0}),
    note:"A slab-like rectangular upper deck pushed forward on concrete pillars."},
  regular:{label:"1990s box stand", era:"1970s–90s", clad:0x51677a, look:"sheet", wall:"clad", facade:{},
    tiers:() => [t("seated",22,22)],
    roof:() => R("slope",{mat:"translucent",lift:6,reach:1.5,tilt:3,support:"truss"}),
    note:"The post-Taylor Report box: one tier under a roof hung from a big goalpost truss, so nobody looks round a pillar."},
  deeproof:{label:"Deep roof on columns", era:"1970s–90s", clad:0x5d6b72, look:"sheet", wall:"clad", facade:{},
    tiers:() => [t("seated",26,22)],
    roof:() => R("slope",{mat:"metal",lift:5,reach:4,tilt:0,support:"columns"}),
    note:"A huge flat roof that reaches out over the pitch, propped on a row of columns."},
  modern:{label:"Modern two-tier", era:"Modern", clad:0x7f888c, look:"fins", wall:"clad", facade:{fins:true},
    tiers:() => [t("seated",22,22), t("exec",4,22,true,{over:2,gap:3.6}), t("seated",14,28,true,{over:3,gap:3})],
    roof:() => R("slope",{mat:"translucent",lift:7,reach:2,tilt:6,support:"ribs"}),
    note:"Two big decks with executive boxes between, a cantilever roof with exposed ribs and metal fins outside."},
  compact:{label:"Compact steep stand", era:"Modern", clad:0x3f4a52, look:"fins", wall:"clad", facade:{fins:true},
    tiers:() => [t("seated",28,24)],
    roof:() => R("slope",{mat:"translucent",lift:5,reach:3,tilt:8,support:"ribs"}),
    note:"One tight, steep tier pressed right up to the pitch, European style."},
  hugeend:{label:"Huge end stand", era:"Modern", clad:0x6f7a80, look:"fins", wall:"clad", facade:{fins:true, towers:true},
    tiers:() => [t("seated",30,22), t("exec",4,22,true,{over:3,gap:4}), t("seated",26,30,true,{over:8,gap:3.5})],
    roof:() => R("slope",{mat:"translucent",lift:8,reach:4,tilt:6,support:"masts"}),
    note:"A monumental end: a deep lower tier, a box level, and a vast upper deck thrown forward over it."},
  deepcant:{label:"Deep cantilevered deck", era:"Modern", clad:0x8a949a, look:"fins", wall:"clad", facade:{fins:true},
    tiers:() => [t("seated",20,22), t("seated",24,30,true,{over:10,gap:4.6})],
    roof:() => R("slope",{mat:"translucent",lift:7,reach:4,tilt:5,curve:0.5,support:"ribs"}),
    note:"An upper tier that projects ten metres out over the lower one, under a curved ribbed roof."},
  showpiece:{label:"Glass showpiece", era:"Modern", clad:0x9cc3d6, look:"glass", wall:"glassClad", facade:{glass:true},
    tiers:() => [t("seated",24,22), t("exec",6,22,true,{over:2,gap:3.6}), t("seated",16,28,true,{over:4,gap:3})],
    roof:() => R("slope",{mat:"glass",lift:7,reach:3,tilt:6,curve:0.6}),
    note:"A signature stand: glazed facade, two decks of boxes and a sweeping curved glass roof."},
  wall:{label:"Standing wall", era:"Specialist", clad:0x2c3135, look:"fins", wall:"clad", facade:{fins:true},
    tiers:() => [t("rail",46,24)],
    roof:() => R("slope",{mat:"translucent",lift:6,reach:2,tilt:6,support:"ribs"}),
    note:"One huge, steep single tier of rail seats for safe standing, in the spirit of Dortmund's Yellow Wall."},
  urban:{label:"Tall urban stand", era:"Specialist", clad:0x58524c, look:"grid", wall:"clad", facade:{towers:true, mullions:true},
    tiers:() => [t("seated",12,26), t("seated",12,30,true,{over:1,gap:3}), t("seated",12,32,true,{over:1,gap:3})],
    roof:() => R("slope",{mat:"metal",lift:4,reach:1,tilt:0}),
    note:"Tall, thin and stacked: three short, steep tiers squeezed onto a narrow plot."},
  american:{label:"American upper decks", era:"Specialist", clad:0x6b6f74, look:"brick", wall:"clad", facade:{towers:true},
    tiers:() => [t("seated",24,22), t("exec",4,22,true,{over:2,gap:4}), t("seated",22,32,true,{over:11,gap:4.5})],
    roof:() => R("slope",{mat:"metal",lift:3,reach:-12,tilt:10}),
    note:"A big lower bowl, a ring of suites, and a towering upper deck hanging far over it under a thin canopy."},
  unfinished:{label:"Unfinished terrace", era:"Specialist", clad:0xa9a49a, look:"plain", wall:"concrete", facade:{},
    tiers:() => [t("terrace",10,20,false)],
    roof:() => R("none"),
    note:"A few bare concrete steps, as if the money ran out."}
};
/* Quick size presets for a stand: the shape of the tier stack, not its look. */
const SCALES = {
  small:{label:"Small", tiers:() => [t("seated",10,22)], roof:{reach:0, lift:4}},
  terrace:{label:"Big terrace", tiers:() => [t("terrace",45,22,false)], roof:{reach:-4, lift:4}},
  major:{label:"Major two-tier", tiers:() => [t("seated",24,22), t("seated",20,30,true,{over:6,gap:4})], roof:{reach:2, lift:7}},
  monument:{label:"Monumental", tiers:() => [t("seated",30,22), t("exec",4,22,true,{over:3,gap:4}), t("seated",30,30,true,{over:12,gap:4.5})], roof:{reach:4, lift:8}}
};
const SWATCHES = [["Claret","#7d1f33"],["Red","#c3322b"],["Royal blue","#1f3f8f"],["Sky blue","#5aa6d6"],["Amber","#dca322"],["Green","#2f6b3d"],["Graphite","#2c3135"]];
const SIDES = ["N","S","E","W"];
const SIDE_NAMES = {N:"Main stand",S:"Opposite stand",E:"East end",W:"West end"};
const OPPOSITE = {N:"S",S:"N",E:"W",W:"E"};
const CORNERS = [
  {key:"NE",a:"N",b:"E",name:"Main / East corner",g:3},
  {key:"SE",a:"E",b:"S",name:"East / Opposite corner",g:0},
  {key:"SW",a:"S",b:"W",name:"Opposite / West corner",g:1},
  {key:"NW",a:"W",b:"N",name:"West / Main corner",g:2}
];
const SIDE_GROUPS = {S:[0,1], W:[1,2], N:[2,3], E:[3,0]};
const GROUP_KEY = ["SE","SW","NW","NE"];
/* Which corner sits at each end of a side, in the direction its path runs. */
const SIDE_ENDS = {N:["NW","NE"], S:["SE","SW"], E:["NE","SE"], W:["SW","NW"]};
const clone = o => JSON.parse(JSON.stringify(o));
const mk = (style, tiers, roof) => ({style, tiers: tiers || STYLES[style].tiers(), roof: Object.assign(STYLES[style].roof(), roof || {}), dist:null, extend:0, facade:Object.assign({}, STYLES[style].facade)});
const corner = (mode, tiers, roof) => ({mode, tiers: tiers || "all", roof: roof !== false});
const allCorners = (mode, tiers) => ({NE:corner(mode,tiers), SE:corner(mode,tiers), SW:corner(mode,tiers), NW:corner(mode,tiers)});
const BASE = {
  version:6, sport:"football", custom:{kind:"plain",W:100,H:64,r:0,surface:"grass",floor:0}, layout:"stands", cornerShape:"curved", setback:8, corner:14,
  bowl:mk("modern",[t("seated",26,20),t("exec",4,22,true,{over:2,gap:3.6}),t("seated",14,28,true,{over:3})]),
  stands:{N:mk("modern"),S:mk("regular"),E:mk("regular"),W:mk("regular")},
  corners:allCorners("open"), cornerCustom:[t("seated",12,22)],
  types:{seated:{row:0.8,width:0.5},exec:{row:1.05,width:0.6},rail:{row:0.8,width:0.5},bench:{row:0.76,width:0.46},terrace:{row:0.38,density:4.7}},
  design:{gangEvery:28,gangWidth:1.1,barrierEvery:9,exitEvery:16,exitWidth:2.4},
  standard:"minimum", limits:Object.assign({},STANDARDS.minimum),
  plot:{on:false,pts:null,clip:true},
  seat:"#c3322b", lights:true, boards:true, scoreboard:false, trim:true, views:[],
  crowd:true, night:false, seeThrough:false, keepClose:true, roofAlign:false,
  arch:{skin:"none", skinShape:"round", arch:false, ramps:false, towers:false, plaza:false, pylons:false}, seatPattern:"solid", seat2:"#f2f2f2", focusIn:null,
  outer:{shape:"follow", fit:"ring", size:0}
};
const Pz = o => Object.assign(clone(BASE), o);
const PRESETS = {
  ot:Pz({sport:"football",layout:"hybrid",cornerShape:"curved",setback:8,corner:0,
    bowl:mk("modern",[t("seated",34,20)],{shape:"none"}),
    stands:{N:mk("modern",[t("exec",4,22,true,{over:0,gap:3}),t("seated",27,28,true,{over:0})]),S:mk("regular",[],{shape:"slope",support:"none"}),
      E:mk("modern",[t("exec",3,22,true,{over:0,gap:3}),t("seated",28,28,true,{over:0})]),W:mk("modern",[t("exec",3,22,true,{over:0,gap:3}),t("seated",28,28,true,{over:0})])},
    corners:allCorners("split"),
    types:{seated:{row:0.8,width:0.47},exec:{row:1.05,width:0.6},rail:{row:0.8,width:0.5},bench:{row:0.76,width:0.46},terrace:{row:0.38,density:4.7}},
    design:{gangEvery:28,gangWidth:1.1,barrierEvery:9,exitEvery:14,exitWidth:2.4},seat:"#c3322b",lights:false}),
  monument:Pz({sport:"football",layout:"stands",cornerShape:"curved",setback:9,
    stands:{N:mk("regular",[t("seated",20,22)]),S:mk("regular",[t("seated",20,22)]),W:mk("regular",[t("seated",18,22)]),
      E:mk("hugeend")},
    corners:{NE:corner("blend","lower"),SE:corner("blend","lower"),SW:corner("open"),NW:corner("open")},seat:"#1f3f8f",lights:true}),
  mixed:Pz({sport:"football",layout:"stands",cornerShape:"square",setback:7,
    stands:{N:mk("brickmain"),E:mk("hugeend"),S:mk("brutalist"),W:mk("kop",[t("terrace",40,22,false)])},
    corners:{NE:corner("blend","lower"),SE:corner("open"),SW:corner("open"),NW:corner("open")},seat:"#7d1f33",lights:true}),
  dell:Pz({sport:"football",layout:"stands",cornerShape:"square",setback:6,
    stands:{N:mk("regular",[t("seated",14,22)]),S:mk("historic",[t("seated",14,18)]),
      E:mk("brutalist",[t("seated",24,22),t("exec",3,22,true,{over:2,gap:3.6})],{reach:1.5}),W:mk("regular",[t("seated",12,22)])},
    corners:{NE:corner("blend"),SE:corner("open"),SW:corner("open"),NW:corner("open")},
    plot:{on:true,pts:[[-67,-52],[96,-52],[64,56],[-67,56]],clip:true},seat:"#c3322b",lights:true}),
  leitch:Pz({sport:"football",layout:"stands",cornerShape:"square",setback:6,
    stands:{N:mk("historic"),S:mk("historic",[t("seated",16,18,false),t("seated",10,24,false,{over:3,gap:3.4,pillars:true})]),E:mk("historic",[t("seated",12,18,false),t("seated",10,24,false,{over:3,gap:3.4,pillars:true})]),W:mk("kop",[t("terrace",30,22,false)])},
    corners:{NE:corner("blend"),SE:corner("blend"),SW:corner("open"),NW:corner("open")},seat:"#1f3f8f",lights:true}),
  bowl:Pz({sport:"football",layout:"bowl",cornerShape:"curved",setback:8,corner:16,bowl:mk("modern",[t("seated",28,20),t("exec",5,22,true,{over:0,gap:3}),t("seated",15,28,true,{over:0})]),seat:"#c3322b",lights:false}),
  wall:Pz({sport:"football",layout:"stands",cornerShape:"angled",setback:9,
    stands:{N:mk("modern",[t("seated",22,22),t("exec",4,22,true,{over:2,gap:3.6}),t("seated",10,28,true,{over:3})]),S:mk("modern",[t("seated",22,22),t("seated",10,28,true,{over:3})]),
      E:mk("brutalist",[t("seated",22,20)]),W:mk("wall",[t("rail",34,24)])},
    corners:allCorners("blend"),seat:"#dca322",lights:false}),
  urban:Pz({sport:"football",layout:"stands",cornerShape:"square",setback:5,
    stands:{N:mk("urban"),S:mk("compact",[t("seated",20,24)]),E:mk("extended",[t("terrace",12,18,false),t("seated",10,24,true,{over:2,gap:3.6})]),W:mk("unfinished")},
    corners:{NE:corner("blend","upper"),SE:corner("open"),SW:corner("open"),NW:corner("open")},
    plot:{on:true,pts:[[-62,-60],[100,-60],[62,50],[-62,50]],clip:true},seat:"#5aa6d6",lights:true}),
  wrestle:Pz({sport:"custom",custom:{kind:"wrestleball",W:16.5,H:4.5,r:0,surface:"grass",floor:0},layout:"stands",cornerShape:"angled",setback:2.5,corner:6,
    stands:{N:mk("modern",[t("seated",12,24)]),S:mk("regular",[t("bench",9,24)],{shape:"none"}),E:mk("kop",[t("rail",8,30,true)],{shape:"none"}),W:mk("kop",[t("rail",8,30,true)],{shape:"none"})},
    corners:{NE:corner("blend"),SE:corner("open"),SW:corner("open"),NW:corner("open")},seat:"#2f6b3d",lights:true,boards:false,focusIn:2.5}),
  fight:Pz({sport:"custom",custom:{kind:"cage",W:9.1,H:9.1,r:2.66,surface:"arena",floor:5},layout:"bowl",cornerShape:"angled",setback:3,corner:0,
    bowl:mk("modern",[t("seated",22,26,true),t("exec",2,22,true,{over:1,gap:3.4}),t("seated",14,32,true,{over:2,gap:4})],{shape:"closed",mat:"metal",support:"none",lift:3}),seat:"#2c3135",lights:false,boards:false,night:true,seeThrough:true,seatPattern:"tiers",seat2:"#b3202a",focusIn:4}),
  bearpit:Pz({sport:"custom",custom:{kind:"boxing",W:7.3,H:7.3,r:0,surface:"arena",floor:4},layout:"stands",cornerShape:"square",setback:3,corner:0,
    stands:{N:mk("brickmain",[t("seated",20,30,true),t("seated",10,33,true,{over:2,gap:4})],{shape:"gable",mat:"metal",support:"truss",lift:2,reach:2}),
      S:mk("brickmain",[t("seated",20,30,true),t("seated",10,33,true,{over:2,gap:4})],{shape:"gable",mat:"metal",support:"truss",lift:2,reach:2}),
      E:mk("brickmain",[t("terrace",24,24,true)],{shape:"slope",mat:"metal",support:"none",lift:2,reach:2}),W:mk("brickmain",[t("terrace",24,24,true)],{shape:"slope",mat:"metal",support:"none",lift:2,reach:2})},
    corners:allCorners("blend"),seat:"#7d1f33",lights:false,boards:false,night:true,seeThrough:false,focusIn:3.5}),
  bullring:Pz({sport:"custom",custom:{kind:"bullring",W:50,H:50,r:25,surface:"sand",floor:0},layout:"bowl",setback:6,corner:0,
    bowl:mk("interwar",[t("seated",18,22),t("seated",8,28,true,{over:0,gap:3.4,pillars:true})],{shape:"slope",mat:"metal",reach:-6,lift:3,support:"columns"}),seat:"#c3322b",lights:false,boards:false}),
  /* The lower tier wraps an athletics track; a deep upper tier floats behind it on a true oval. */
  cartuja:Pz({sport:"athletics",layout:"bowl",cornerShape:"curved",setback:4,corner:16,
    bowl:mk("modern",[t("seated",20,18),t("seated",32,27,true,{over:0,gap:4.5})],{shape:"slope",mat:"translucent",support:"ribs",reach:-12,lift:6,tilt:8,curve:0.3}),
    outer:{shape:"oval",fit:"ring",size:4},focusIn:8,seat:"#dca322",seatPattern:"bands",seat2:"#f2f2f2",lights:false,boards:false}),
  /* A pitch-hugging lower bowl inside two oval upper rings: a modern take on Buenos Aires' great oval. */
  oval:Pz({sport:"football",layout:"bowl",cornerShape:"curved",setback:9,corner:12,
    bowl:mk("interwar",[t("seated",30,20),t("seated",18,28,true,{over:0,gap:4}),t("seated",16,31,true,{over:0,gap:3.6})],{shape:"none"}),
    outer:{shape:"oval",fit:"ring",size:0},seat:"#c3322b",seatPattern:"bands",seat2:"#f2f2f2",lights:true,boards:true}),
  ballpark:Pz({sport:"baseball",layout:"stands",cornerShape:"curved",setback:10,
    stands:{N:mk("american",[t("seated",20,22),t("seated",10,28,true,{over:4,gap:4})]),W:mk("american",[t("seated",20,22),t("seated",10,28,true,{over:4,gap:4})]),
      S:mk("regular",[t("bench",14,24)],{shape:"none"}),E:mk("regular",[t("bench",10,24)],{shape:"none"})},
    corners:{NE:corner("open"),SE:corner("open"),SW:corner("open"),NW:corner("blend")},plot:{on:true,pts:[[-110,-95],[90,-95],[118,62],[-110,110]],clip:true},seat:"#1f3f8f",lights:true,boards:false})
};
/* Signature architecture for some starting points. */
const withArch = (k, a) => { PRESETS[k].arch = Object.assign({}, BASE.arch, a); };
withArch("bowl", {skin:"fins", skinShape:"round", plaza:true});
withArch("monument", {arch:true, plaza:true});
withArch("leitch", {pylons:true}); withArch("mixed", {pylons:true});
withArch("wall", {ramps:true});
withArch("fight", {skin:"cushion", skinShape:"round", plaza:true});
withArch("bearpit", {skin:"brick", skinShape:"hull"});
withArch("bullring", {skin:"brick", skinShape:"round"});
withArch("wrestle", {pylons:true});
const KEY = "groundworks-v6", SAVES_KEY = "groundworks-designs";
/* Bring a version 5 design forward instead of throwing it away. */
function migrate(old){
  if (!old || old.version !== 5) return null;
  const s = old, conv = cfg => {
    const oldRoof = cfg.roof, cover = cfg.cover || "full";
    cfg.roof = oldRoof === "none" ? R("none") : R(oldRoof === "gable" ? "gable" : oldRoof === "closed" ? "closed" : "slope",
      {reach: cover === "full" ? 1.5 : -10, support: oldRoof === "truss" ? "truss" : oldRoof === "columns" ? "columns" : "none", mat: oldRoof === "columns" || oldRoof === "gable" ? "metal" : "translucent", lift: oldRoof === "columns" || oldRoof === "gable" ? 3 : 6});
    delete cfg.cover; if (!STYLES[cfg.style]) cfg.style = "modern";
    cfg.tiers = (cfg.tiers || []).map(x => Object.assign({over:-0.5, gap:3, pillars:false}, x));
    cfg.dist = null; cfg.extend = 0; cfg.facade = Object.assign({}, STYLES[cfg.style].facade);
  };
  conv(s.bowl); SIDES.forEach(k => conv(s.stands[k]));
  for (const c of CORNERS){ const m = s.corners[c.key]; s.corners[c.key] = corner(m === "off" ? "open" : m || "open"); }
  s.cornerCustom = (s.cornerCustom || []).map(x => Object.assign({over:-0.5, gap:3, pillars:false}, x));
  Object.assign(s, {version:6, scoreboard:false, trim:true, views:[]});
  return s;
}
let S;
(function load(){
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch(e) { S = null; }
  if (!S){ try { S = migrate(JSON.parse(localStorage.getItem("groundworks-v5"))); } catch(e) { S = null; } }
  if (!S || S.version !== 6 || !SPORTS[S.sport]) S = clone(PRESETS.ot);
})();
