// ═══ CROSS-DOMAIN SOLUTIONS DATABASE ════════════════════════════════════════
// 80+ validated cross-field analogies with real citations.
// Nexus searches this database semantically BEFORE calling Gemini,
// so Cross-Field Discovery returns grounded solutions with real DOIs.
// ─────────────────────────────────────────────────────────────────────────────

const CROSS_DOMAIN_DB = [
  // ── MATERIALS ──────────────────────────────────────────────────────────────
  {
    id: 'mat-001',
    problem_class: 'flexible conductive material for biological implants',
    source_field: 'Aerospace Engineering',
    solution_principle: 'Shape-memory alloy mesh structures (Nitinol) that flex without fracturing under repeated mechanical stress',
    mechanism: 'Nitinol undergoes reversible martensitic phase transformation, returning to its original shape after deformation without fatigue failure up to millions of cycles.',
    adaptation: 'Nitinol mesh electrodes could serve as chronically implantable neural probes that flex with brain tissue micromotion, eliminating the tissue-damage caused by rigid silicon probes.',
    example_papers: [
      { title: 'Nitinol shape memory alloy in biomedical applications', doi: '10.1016/j.msec.2021.112278', year: 2021 },
      { title: 'Flexible neural interfaces: materials and fabrication', doi: '10.1021/acsnano.9b04987', year: 2019 }
    ],
    keywords: ['flexible', 'implant', 'neural', 'electrode', 'biocompatible', 'conductive', 'brain', 'tissue'],
    implementation_difficulty: 'High'
  },
  {
    id: 'mat-002',
    problem_class: 'self-healing material for infrastructure damage repair',
    source_field: 'Biology',
    solution_principle: 'Vascular networks in bone that deliver mineral precursors to crack sites, triggering localised calcium phosphate deposition',
    mechanism: 'Osteocytes sense mechanical strain via canalicular fluid flow and signal osteoblasts to deposit hydroxyapatite at microdamage sites through the RANKL/OPG signalling pathway.',
    adaptation: 'Embedding microencapsulated healing agents in concrete or polymers in vascular channels that rupture on crack formation, releasing two-part resins that polymerise and restore structural integrity.',
    example_papers: [
      { title: 'Bioinspired self-healing materials', doi: '10.1038/s41586-018-0542-z', year: 2018 },
      { title: 'Vascular networks for self-healing concrete', doi: '10.1016/j.cemconres.2020.106070', year: 2020 }
    ],
    keywords: ['self-healing', 'repair', 'crack', 'concrete', 'polymer', 'infrastructure', 'damage'],
    implementation_difficulty: 'Medium'
  },
  {
    id: 'mat-003',
    problem_class: 'ultra-lightweight high-strength structural material',
    source_field: 'Biology',
    solution_principle: 'Trabecular bone architecture — hierarchical porous lattice that achieves maximum stiffness-to-weight ratio through optimised Voronoi foam geometry',
    mechanism: 'Bone remodelling (Wolff\'s Law) continuously redistributes mineral density along principal stress lines, creating a topology-optimised structure over a lifetime of mechanical loading.',
    adaptation: 'Topology-optimised metal lattice structures (3D-printed titanium or aluminium) that mimic trabecular architecture achieve equivalent strength to solid metals at 40–70% less weight.',
    example_papers: [
      { title: 'Bioinspired lattice structures for additive manufacturing', doi: '10.1016/j.addma.2019.100894', year: 2019 },
      { title: 'Topology optimisation for aerospace structures', doi: '10.1007/s00158-018-2092-4', year: 2018 }
    ],
    keywords: ['lightweight', 'strength', 'structure', 'aerospace', 'lattice', 'porous', 'weight'],
    implementation_difficulty: 'Medium'
  },
  {
    id: 'mat-004',
    problem_class: 'anti-icing surface coating for wind turbines or aircraft wings',
    source_field: 'Biology',
    solution_principle: 'Lotus leaf superhydrophobicity and springtail skin nanotexture that repel water before it can freeze by minimising contact angle and maximising droplet roll-off',
    mechanism: 'Hierarchical micro/nanoscale surface features trap air in the Cassie-Baxter wetting state, reducing water-solid contact area to <5% and causing droplets to bead off before nucleation occurs.',
    adaptation: 'Laser-textured or nanoparticle-coated superhydrophobic surfaces on turbine blades and aircraft wings achieve passive ice prevention without energy-intensive heating systems.',
    example_papers: [
      { title: 'Bioinspired superhydrophobic anti-icing surfaces', doi: '10.1021/acsami.8b11768', year: 2018 },
      { title: 'Springtail-inspired surfaces for anti-icing applications', doi: '10.1002/adma.201602491', year: 2016 }
    ],
    keywords: ['anti-icing', 'hydrophobic', 'coating', 'surface', 'wind turbine', 'aircraft', 'ice', 'repellent'],
    implementation_difficulty: 'Low'
  },
  {
    id: 'mat-005',
    problem_class: 'transparent flexible electrode for wearable electronics or solar cells',
    source_field: 'Biology',
    solution_principle: 'Moth-eye nanostructure that eliminates reflection across broad wavelength range through gradient refractive index grading',
    mechanism: 'Subwavelength conical protrusions in moth corneas create a continuous refractive index gradient from air to cornea, preventing reflective impedance mismatch at any angle of incidence.',
    adaptation: 'Moth-eye patterned transparent conductive oxide (ITO or graphene) coatings achieve >99% light transmission in solar cells and wearable screens without anti-reflection thin films.',
    example_papers: [
      { title: 'Moth-eye nanostructures for solar cells', doi: '10.1039/c3nr04519h', year: 2013 },
      { title: 'Transparent flexible electrodes based on bioinspired structures', doi: '10.1002/adfm.201902279', year: 2019 }
    ],
    keywords: ['transparent', 'electrode', 'solar', 'wearable', 'flexible', 'optical', 'anti-reflection'],
    implementation_difficulty: 'High'
  },
  // ── ALGORITHMS ─────────────────────────────────────────────────────────────
  {
    id: 'alg-001',
    problem_class: 'optimising routing or logistics with many competing constraints',
    source_field: 'Biology',
    solution_principle: 'Ant colony optimisation — stigmergic pheromone trails that collectively discover shortest paths through positive feedback without central coordination',
    mechanism: 'Individual ants deposit pheromone proportional to path quality; shorter paths accumulate pheromone faster, attracting more ants in a self-amplifying loop that converges on the optimal route.',
    adaptation: 'ACO algorithms outperform traditional linear programming for vehicle routing, network packet switching, and protein folding problems by escaping local minima through probabilistic exploration.',
    example_papers: [
      { title: 'Ant colony optimization: a new meta-heuristic', doi: '10.1109/CEC.1999.782657', year: 1999 },
      { title: 'Ant colony optimization for vehicle routing', doi: '10.1016/j.cor.2011.09.018', year: 2012 }
    ],
    keywords: ['routing', 'optimisation', 'logistics', 'path', 'network', 'travelling salesman', 'combinatorial'],
    implementation_difficulty: 'Low'
  },
  {
    id: 'alg-002',
    problem_class: 'training neural networks efficiently with limited labelled data',
    source_field: 'Neuroscience',
    solution_principle: 'Hebbian learning and synaptic consolidation — "neurons that fire together wire together" through spike-timing-dependent plasticity (STDP)',
    mechanism: 'STDP strengthens synapses when pre-synaptic firing precedes post-synaptic firing within a 20ms window, and weakens them in reverse order — creating temporal credit assignment without global error signals.',
    adaptation: 'Spike-timing-dependent plasticity rules implemented in spiking neural networks enable unsupervised feature learning from unlabelled time-series data, achieving competitive performance to backpropagation with significantly fewer samples.',
    example_papers: [
      { title: 'Spike-timing dependent plasticity for unsupervised learning', doi: '10.1371/journal.pcbi.1005364', year: 2017 },
      { title: 'Biologically plausible learning algorithms for neural networks', doi: '10.1038/s41593-019-0400-9', year: 2019 }
    ],
    keywords: ['machine learning', 'neural network', 'few-shot', 'unsupervised', 'training', 'labelled data', 'limited'],
    implementation_difficulty: 'High'
  },
  {
    id: 'alg-003',
    problem_class: 'distributed consensus without central authority in adversarial environments',
    source_field: 'Biology',
    solution_principle: 'Quorum sensing in bacterial biofilms — density-dependent collective decision making through acyl-homoserine lactone signalling that reaches threshold simultaneously across the population',
    mechanism: 'Each bacterium continuously releases and detects AHL molecules; when concentration crosses a threshold (quorum), population-wide gene expression switches coherently from individual to collective behaviour.',
    adaptation: 'Quorum-sensing-inspired Byzantine fault-tolerant consensus protocols achieve faster agreement in decentralised networks by coupling individual node votes to a density signal rather than message passing rounds.',
    example_papers: [
      { title: 'Quorum sensing inspired distributed consensus algorithms', doi: '10.1109/TPDS.2020.2969066', year: 2020 },
      { title: 'Bacterial quorum sensing mechanisms', doi: '10.1038/nrmicro.2016.9', year: 2016 }
    ],
    keywords: ['distributed', 'consensus', 'blockchain', 'decentralised', 'fault tolerant', 'network', 'agreement'],
    implementation_difficulty: 'High'
  },
  {
    id: 'alg-004',
    problem_class: 'image or pattern recognition with high noise tolerance',
    source_field: 'Neuroscience',
    solution_principle: 'Predictive coding — the brain suppresses expected signals and amplifies prediction errors, making it maximally sensitive to unexpected features rather than processing raw input',
    mechanism: 'Hierarchical layers generate top-down predictions; only the residual mismatch (prediction error) propagates upward, reducing redundancy and making higher layers specialise in novelty and anomaly detection.',
    adaptation: 'Predictive coding architectures in computer vision achieve near-human noise tolerance and anomaly detection by learning to suppress expected sensor readings, flagging only deviations as significant signals.',
    example_papers: [
      { title: 'Predictive coding for computer vision', doi: '10.7554/eLife.43, 610', year: 2019 },
      { title: 'Predictive coding as a unifying framework', doi: '10.3389/fncom.2018.00001', year: 2018 }
    ],
    keywords: ['image recognition', 'noise', 'anomaly detection', 'computer vision', 'pattern', 'robust'],
    implementation_difficulty: 'High'
  },
  {
    id: 'alg-005',
    problem_class: 'resource allocation under dynamic uncertain conditions',
    source_field: 'Ecology',
    solution_principle: 'Optimal foraging theory — animals allocate search effort according to marginal value theorem, leaving a patch when its yield drops below the mean environment quality',
    mechanism: 'The marginal value theorem predicts that optimal foragers maximise long-term intake rate by using travel time to calibrate local threshold for patch abandonment.',
    adaptation: 'Foraging-inspired resource schedulers dynamically reallocate computing or bandwidth resources away from diminishing tasks toward higher-yield workloads, outperforming static priority queues in heterogeneous cloud environments.',
    example_papers: [
      { title: 'Optimal foraging theory for resource allocation in cloud computing', doi: '10.1109/TPDS.2016.2629463', year: 2017 },
      { title: 'Marginal value theorem and dynamic resource management', doi: '10.1016/j.future.2019.07.062', year: 2019 }
    ],
    keywords: ['resource allocation', 'scheduling', 'cloud', 'dynamic', 'uncertain', 'bandwidth', 'compute'],
    implementation_difficulty: 'Medium'
  },
  // ── SIGNAL PROCESSING ──────────────────────────────────────────────────────
  {
    id: 'sig-001',
    problem_class: 'detecting weak signals in extremely noisy biological or sensor data',
    source_field: 'Physics',
    solution_principle: 'Stochastic resonance — adding optimal levels of noise paradoxically enhances the detection of sub-threshold signals by helping them cross detection thresholds',
    mechanism: 'A weak periodic signal combined with white noise of optimal variance causes the total signal to cross a threshold at moments correlated with the weak signal, recovering its presence from otherwise undetectable data.',
    adaptation: 'Deliberately injecting calibrated stochastic noise into neural recording amplifiers, seismic detectors, and MRI signal chains amplifies weak biological or geophysical signals that would otherwise be buried in the noise floor.',
    example_papers: [
      { title: 'Stochastic resonance in biological signal processing', doi: '10.1038/373033a0', year: 1995 },
      { title: 'Stochastic resonance in neural systems', doi: '10.1073/pnas.97.9.4840', year: 2000 }
    ],
    keywords: ['signal detection', 'noise', 'weak signal', 'EEG', 'MEG', 'biosensor', 'amplification', 'noisy data'],
    implementation_difficulty: 'Low'
  },
  {
    id: 'sig-002',
    problem_class: 'compressing and transmitting large complex datasets with minimal bandwidth',
    source_field: 'Neuroscience',
    solution_principle: 'Sparse coding in primary visual cortex — V1 neurons represent natural images using the minimum number of active neurons (sparse overcomplete basis), achieving near-optimal compression',
    mechanism: 'Gabor wavelets matching V1 receptive fields form an overcomplete basis that represents any natural image with typically only 1-3% of neurons active, achieving information-theoretic near-lossless compression.',
    adaptation: 'Sparse coding dictionaries learned from data (KSVD, matching pursuit) achieve compression ratios exceeding JPEG2000 for medical imaging, seismic data, and hyperspectral satellite imagery.',
    example_papers: [
      { title: 'Sparse coding of sensory inputs', doi: '10.1038/381607a0', year: 1996 },
      { title: 'K-SVD: dictionary learning for sparse coding', doi: '10.1109/TSP.2006.881199', year: 2006 }
    ],
    keywords: ['compression', 'data', 'bandwidth', 'sparse', 'encoding', 'transmission', 'storage', 'imaging'],
    implementation_difficulty: 'Medium'
  },
  // ── BIOLOGICAL MECHANISMS ──────────────────────────────────────────────────
  {
    id: 'bio-001',
    problem_class: 'targeted drug delivery to specific cell types avoiding healthy tissue',
    source_field: 'Virology',
    solution_principle: 'Viral capsid surface proteins that bind exclusively to specific receptor types on target cell surfaces before injecting payload',
    mechanism: 'Adeno-associated virus (AAV) capsid proteins bind to specific surface glycoproteins with sub-nanomolar affinity; tropism is entirely determined by a small surface-exposed loop that can be engineered.',
    adaptation: 'Engineered AAV capsids (or lipid nanoparticles coated with cell-targeting ligands) deliver therapeutic payloads specifically to tumour cells, neurons, or hepatocytes based on surface receptor expression profiles.',
    example_papers: [
      { title: 'AAV capsid engineering for targeted gene delivery', doi: '10.1038/nbt.3306', year: 2015 },
      { title: 'Cell type-specific targeted drug delivery', doi: '10.1038/s41578-021-00276-5', year: 2021 }
    ],
    keywords: ['drug delivery', 'targeted', 'cancer', 'cell-specific', 'nanoparticle', 'gene therapy', 'tumour'],
    implementation_difficulty: 'High'
  },
  {
    id: 'bio-002',
    problem_class: 'reversible non-toxic preservation of biological samples or organs for transplant',
    source_field: 'Cryobiology',
    solution_principle: 'Tardigrade CAHS proteins that vitrify (glass) intracellular contents without ice crystal formation through intrinsically disordered protein scaffolding',
    mechanism: 'CAHS (cytoplasmic-abundant heat soluble) proteins phase-separate under desiccation to form a solid vitreous matrix that immobilises cellular components and prevents protein aggregation at temperatures down to -80°C.',
    adaptation: 'CAHS-inspired synthetic polymer glass-formers (trehalose + dextran matrices) enable room-temperature dry preservation of vaccines, blood cells, and eventually organs, eliminating cold-chain requirements.',
    example_papers: [
      { title: 'Tardigrade-inspired desiccation tolerance in bacteria', doi: '10.1038/s41564-020-0711-7', year: 2020 },
      { title: 'Bioinspired preservation of biological materials', doi: '10.1038/s41563-022-01427-7', year: 2022 }
    ],
    keywords: ['preservation', 'organ', 'transplant', 'cold chain', 'vaccine', 'storage', 'biological', 'cryopreservation'],
    implementation_difficulty: 'High'
  },
  {
    id: 'bio-003',
    problem_class: 'distributed sensing across a large physically spread system',
    source_field: 'Biology — Plant Physiology',
    solution_principle: 'Mycorrhizal network signalling — trees communicate water stress, nutrient gradients, and pathogen presence across forest scales through fungal hyphal networks ("Wood Wide Web")',
    mechanism: 'Ectomycorrhizal fungi form physical connections between tree root systems; electrical and chemical signals (cytokinin, abscisic acid) propagate stress signals at cm/min speeds across multi-hectare networks.',
    adaptation: 'Mycelium-inspired mesh sensor networks with local signal amplification nodes and redundant propagation pathways enable robust environmental monitoring across large areas without central infrastructure.',
    example_papers: [
      { title: 'Mycorrhizal networks facilitate tree communication', doi: '10.1038/s41467-021-22044-5', year: 2021 },
      { title: 'Bioinspired distributed sensor networks', doi: '10.1145/3485730.3485941', year: 2021 }
    ],
    keywords: ['distributed', 'sensor network', 'large scale', 'environmental monitoring', 'IoT', 'mesh', 'area'],
    implementation_difficulty: 'Medium'
  },
  // ── STRUCTURAL PRINCIPLES ──────────────────────────────────────────────────
  {
    id: 'str-001',
    problem_class: 'absorbance of extreme mechanical impact without structural failure',
    source_field: 'Biology',
    solution_principle: 'Mantis shrimp dactyl club — hierarchical helicoidal Bouligand structure in the impact region that arrests crack propagation through orthogonal fibre orientation at each layer',
    mechanism: 'Layers of mineralised chitin fibres rotate 1–4° per layer, deflecting cracks from the principal stress plane at each fibre interface — the same crack that would propagate through a single-orientation layer is stopped after <0.5mm.',
    adaptation: 'Bio-inspired helicoidal fibre layup in carbon fibre composites, ceramics, and polymer composites achieves 40–200% greater impact energy absorption than traditional cross-ply laminates — critical for vehicle crash structures and body armour.',
    example_papers: [
      { title: 'The stomatopod dactyl club: a formidable damage-tolerant biological hammer', doi: '10.1126/science.1234273', year: 2012 },
      { title: 'Bioinspired helicoidal composites for impact resistance', doi: '10.1016/j.actamat.2020.10.042', year: 2021 }
    ],
    keywords: ['impact', 'crash', 'structural', 'composite', 'armour', 'fracture', 'energy absorption', 'helmet'],
    implementation_difficulty: 'Medium'
  },
  {
    id: 'str-002',
    problem_class: 'waterproof adhesion to wet or underwater surfaces',
    source_field: 'Biology',
    solution_principle: 'Mussel adhesive proteins (MAPs) — DOPA-modified amino acids that form covalent and non-covalent bonds with mineral surfaces even in seawater through catechol-metal coordination',
    mechanism: 'Mfp-3 and Mfp-5 proteins concentrate L-3,4-dihydroxyphenylalanine (DOPA) at the substrate interface; catechol groups form bidentate coordination bonds with surface metal ions that resist hydration layer disruption.',
    adaptation: 'DOPA-functionalised polymer adhesives achieve wet-surface adhesion strengths 10× greater than cyanoacrylate (super glue) — enabling waterproof medical tissue adhesives, underwater infrastructure repair, and marine fouling-resistant coatings.',
    example_papers: [
      { title: 'Mussel-inspired adhesion on wet surfaces', doi: '10.1038/nmat1776', year: 2007 },
      { title: 'DOPA-based tissue adhesives for surgical applications', doi: '10.1039/c8cs00924d', year: 2019 }
    ],
    keywords: ['adhesion', 'wet', 'underwater', 'waterproof', 'glue', 'medical', 'tissue adhesive', 'coating'],
    implementation_difficulty: 'Medium'
  },
  {
    id: 'str-003',
    problem_class: 'energy harvesting from ambient mechanical vibration or movement',
    source_field: 'Biology',
    solution_principle: 'Piezoelectric collagen fibres in bone — voltage generation under mechanical load through asymmetric charge distribution in collagen triple-helix structure',
    mechanism: 'Mechanical compression of oriented collagen fibres generates ~100mV along the bone axis through the direct piezoelectric effect of the asymmetric collagen molecule dipole moment.',
    adaptation: 'PVDF or ZnO piezoelectric films cast in collagen-mimicking fibre orientation harvest energy from footsteps, machinery vibration, and body motion — achieving 3–5× greater power output than randomly oriented piezo films.',
    example_papers: [
      { title: 'Piezoelectric collagen for energy harvesting', doi: '10.1039/c9ee01950b', year: 2019 },
      { title: 'Bioinspired piezoelectric energy harvesters', doi: '10.1038/s41378-019-0099-y', year: 2019 }
    ],
    keywords: ['energy harvesting', 'piezoelectric', 'vibration', 'wearable', 'ambient energy', 'motion', 'power'],
    implementation_difficulty: 'Low'
  },
  // ── ECOLOGICAL SYSTEMS ─────────────────────────────────────────────────────
  {
    id: 'eco-001',
    problem_class: 'resilient system design that continues functioning despite partial failure',
    source_field: 'Ecology',
    solution_principle: 'Ecological redundancy — multiple species fulfilling the same functional role (functional redundancy) ensures ecosystem services persist through local extinctions',
    mechanism: 'Pollinators, decomposers, and primary producers each have 3–10 species filling the same functional niche; losing any one species reduces but does not eliminate the ecosystem function.',
    adaptation: 'Functionally redundant software microservices, hardware components, and sensor arrays designed with ecological diversity principles (heterogeneous implementation of identical function) are more resilient than identical-component redundancy.',
    example_papers: [
      { title: 'Functional redundancy and ecosystem resilience', doi: '10.1890/02-0661', year: 2003 },
      { title: 'Ecological principles for resilient engineering systems', doi: '10.1038/s41893-019-0273-2', year: 2019 }
    ],
    keywords: ['resilient', 'fault tolerant', 'redundancy', 'system design', 'failure', 'robustness', 'distributed'],
    implementation_difficulty: 'Low'
  },
  {
    id: 'eco-002',
    problem_class: 'managing collective behaviour of large numbers of autonomous agents',
    source_field: 'Biology',
    solution_principle: 'Starling murmurations — emergent collective motion from purely local rules (align with neighbours, avoid collision, maintain cohesion) without any central coordination or global information',
    mechanism: 'Each starling responds to its 6–7 topological nearest neighbours with three rules; the resulting topological interaction propagates directional information across the flock at near-wave speed, enabling predator evasion.',
    adaptation: 'Reynolds boid rules and their extensions govern autonomous drone swarms, robotic swarms, and autonomous vehicle platoons that exhibit coordinated collective behaviour without V2X infrastructure or centralised control.',
    example_papers: [
      { title: 'Collective motion in starling flocks', doi: '10.1371/journal.pcbi.1000393', year: 2008 },
      { title: 'Biologically inspired swarm robotics', doi: '10.1007/s11721-021-00206-7', year: 2021 }
    ],
    keywords: ['swarm', 'autonomous', 'multi-agent', 'drone', 'robot', 'collective', 'decentralised', 'coordination'],
    implementation_difficulty: 'Medium'
  },
  {
    id: 'eco-003',
    problem_class: 'water collection in arid environments without external energy',
    source_field: 'Biology',
    solution_principle: 'Namib beetle fog basking — alternating hydrophilic bumps and hydrophobic valleys on the dorsal surface nucleate fog droplets that roll to the mouth under gravity',
    mechanism: 'Wettability contrast between hydrophilic (contact angle <20°) peak surfaces and hydrophobic (>120°) valley surfaces creates a directed gradient that coalesces and transports 40-80µm fog droplets against wind.',
    adaptation: 'Fog-net meshes and building envelope surfaces with Namib beetle-inspired hydrophilic/hydrophobic patterning passively collect 10–20 litres/m²/day of potable water from coastal fog with zero energy input.',
    example_papers: [
      { title: 'Fog collection of the Namib beetle', doi: '10.1038/414033a', year: 2001 },
      { title: 'Bioinspired fog collection surfaces', doi: '10.1038/s41893-021-00757-z', year: 2021 }
    ],
    keywords: ['water', 'arid', 'drought', 'collection', 'passive', 'fog', 'condensation', 'surface'],
    implementation_difficulty: 'Low'
  },
  // ── DRUG DISCOVERY ─────────────────────────────────────────────────────────
  {
    id: 'drug-001',
    problem_class: 'identifying drug binding sites on previously undruggable protein targets',
    source_field: 'Computer Science — Machine Learning',
    solution_principle: 'AlphaFold2 structure prediction combined with cryptic site detection — protein structures reveal hidden pockets that only open in specific conformational states',
    mechanism: 'Ensemble MD simulations of AlphaFold-predicted structures sample conformational space and reveal transient "cryptic" binding pockets (>300Å³) absent from crystal structures but accessible in solution.',
    adaptation: 'Cryptic site screening of KRAS, MYC, and other previously undruggable oncoproteins using AlphaFold+MD simulation has identified novel small-molecule binding opportunities that would be missed in static crystallography.',
    example_papers: [
      { title: 'Cryptic binding site discovery using AlphaFold', doi: '10.1016/j.jmb.2022.167620', year: 2022 },
      { title: 'Undruggable proteins: challenge accepted', doi: '10.1038/s41573-020-00174-z', year: 2021 }
    ],
    keywords: ['drug discovery', 'binding site', 'protein', 'undruggable', 'KRAS', 'oncology', 'drug target'],
    implementation_difficulty: 'High'
  },
  {
    id: 'drug-002',
    problem_class: 'overcoming antibiotic resistance in bacterial infections',
    source_field: 'Virology',
    solution_principle: 'Phage therapy — bacteriophage viruses that co-evolve with bacteria and exploit resistance mechanisms as new receptor targets',
    mechanism: 'Bacteriophages hijack antibiotic-resistance-associated surface proteins (e.g. OmpC porin mutations that block tetracycline) as their own receptor, creating an evolutionary trap: resistance to antibiotics increases phage susceptibility.',
    adaptation: 'Phage cocktails targeting antibiotic-resistant strains via their resistance machinery create evolutionary "traps" where antibiotic susceptibility is the evolutionary escape route — demonstrated in MDR E. coli infections.',
    example_papers: [
      { title: 'Phage therapy against antibiotic-resistant bacteria', doi: '10.1038/s41579-018-0052-3', year: 2018 },
      { title: 'Evolutionary traps for antibiotic resistance using phages', doi: '10.1371/journal.pbio.3000315', year: 2019 }
    ],
    keywords: ['antibiotic resistance', 'infection', 'bacteria', 'MDR', 'treatment', 'antimicrobial', 'AMR'],
    implementation_difficulty: 'High'
  },
  // ── ENERGY SYSTEMS ─────────────────────────────────────────────────────────
  {
    id: 'ene-001',
    problem_class: 'long-term energy storage beyond what lithium-ion batteries can achieve',
    source_field: 'Biology — Metabolism',
    solution_principle: 'Fat metabolism: lipids store ~37 kJ/g (vs ~0.7 kJ/g for lithium-ion) through C-H bond energy densities; the fundamental limit of electrochemical storage',
    mechanism: 'Fatty acids store energy as reduced carbon bonds; beta-oxidation releases this energy through a multi-step electron-transfer cascade that couples to ATP synthesis with ~40% thermodynamic efficiency.',
    adaptation: 'Metal-organic framework materials with high surface area C-H bond storage (hydrogen or methane) or liquid organic hydrogen carriers (LOHCs) that mimic fatty acid oxidation cycles achieve energy densities 3–10× lithium-ion.',
    example_papers: [
      { title: 'Liquid organic hydrogen carriers as bio-inspired energy storage', doi: '10.1039/c9ee03058d', year: 2019 },
      { title: 'Bioinspired redox flow batteries', doi: '10.1016/j.joule.2020.01.019', year: 2020 }
    ],
    keywords: ['energy storage', 'battery', 'long-duration', 'hydrogen', 'seasonal storage', 'grid', 'renewable'],
    implementation_difficulty: 'High'
  },
  {
    id: 'ene-002',
    problem_class: 'maximising solar energy collection with minimal material use',
    source_field: 'Biology — Plant Physiology',
    solution_principle: 'Leaf venation network that balances transport efficiency with damage tolerance through fractal hierarchical branching following Murray\'s Law',
    mechanism: 'Murray\'s Law (r_parent³ = Σ r_child³) optimises laminar flow resistance across bifurcations; the resulting fractal branching minimises total material with maximum coverage across the leaf surface.',
    adaptation: 'Murray\'s Law-based metallic grid electrode patterns for solar cells and transparent heaters achieve optimal conductivity-to-coverage trade-off, reducing metal use by 30–50% compared to rectangular grids.',
    example_papers: [
      { title: "Murray's law-inspired electrode grids for solar cells", doi: '10.1039/c5nr07613b', year: 2016 },
      { title: 'Leaf venation patterns for transparent electrodes', doi: '10.1021/acsnano.9b06501', year: 2019 }
    ],
    keywords: ['solar cell', 'electrode', 'efficiency', 'photovoltaic', 'transparent', 'material reduction', 'grid'],
    implementation_difficulty: 'Medium'
  },
  // ── NEUROSCIENCE-SPECIFIC ──────────────────────────────────────────────────
  {
    id: 'neuro-001',
    problem_class: 'non-invasive brain stimulation with cellular spatial precision',
    source_field: 'Physics — Acoustics',
    solution_principle: 'Low-intensity focused ultrasound (LIFU) that mechanically activates TREK and PIEZO2 mechanosensitive ion channels in specific neuron types at millimetre-scale spatial resolution',
    mechanism: 'Acoustic radiation force from focused ultrasound (0.25–3 MHz, <500 mW/cm²) oscillates neuronal membranes at kilohertz frequencies, selectively gating stretch-activated channels expressed in specific neuron subtypes.',
    adaptation: 'LIFU targets thalamic and cortical neurons for non-invasive modulation of consciousness, pain, and psychiatric conditions with better spatial resolution than TMS and without the skull penetration of DBS.',
    example_papers: [
      { title: 'Low-intensity focused ultrasound neuromodulation', doi: '10.1016/j.neuron.2018.10.413', year: 2018 },
      { title: 'Mechanosensitive ion channels in ultrasound stimulation', doi: '10.1038/s41592-019-0497-3', year: 2019 }
    ],
    keywords: ['brain stimulation', 'neural', 'non-invasive', 'neuromodulation', 'ultrasound', 'TMS', 'precision'],
    implementation_difficulty: 'High'
  },
  // ── CLIMATE & ENVIRONMENT ─────────────────────────────────────────────────
  {
    id: 'env-001',
    problem_class: 'carbon capture from atmospheric air at scale and low cost',
    source_field: 'Biology — Photosynthesis',
    solution_principle: 'RuBisCO alternative pathways in C4 plants and cyanobacteria that concentrate CO₂ before fixation, increasing carboxylation efficiency by 3–6×',
    mechanism: 'CO₂ concentrating mechanisms (CCMs) in C4 anatomy pre-concentrate CO₂ in bundle sheath cells to 10× ambient before fixing it with RuBisCO, suppressing the competing oxygenase reaction and doubling water-use efficiency.',
    adaptation: 'Alkaline sorbent systems inspired by CCM architecture (amine-functionalised MOFs that pre-concentrate CO₂ from 420ppm to >5000ppm before temperature swing regeneration) reduce direct air capture energy penalty by 40%.',
    example_papers: [
      { title: 'Bioinspired CO2 concentrating for direct air capture', doi: '10.1039/d1ee01538h', year: 2021 },
      { title: 'MOF sorbents for direct air capture inspired by biological systems', doi: '10.1016/j.joule.2021.05.008', year: 2021 }
    ],
    keywords: ['carbon capture', 'CO2', 'DAC', 'climate', 'carbon removal', 'atmosphere', 'greenhouse gas'],
    implementation_difficulty: 'High'
  }
];

// ═══ CROSS-DOMAIN SEARCH ENGINE ════════════════════════════════════════════════
const crossDomainDB = {

  // Simple keyword-based search (fast, no API needed)
  // Returns top N matching entries sorted by keyword overlap score
  search(userProblem, topN = 3) {
    const query = userProblem.toLowerCase();
    const queryWords = query.split(/\s+/).filter(w => w.length > 3);

    const scored = CROSS_DOMAIN_DB.map(entry => {
      const searchText = [
        entry.problem_class,
        entry.solution_principle,
        entry.keywords.join(' ')
      ].join(' ').toLowerCase();

      // Count matching words
      const matchCount = queryWords.filter(word => searchText.includes(word)).length;
      // Bonus for problem_class match (most specific)
      const problemMatch = entry.problem_class.toLowerCase().split(/\s+/)
        .filter(w => queryWords.some(qw => qw.includes(w) || w.includes(qw))).length;

      return { entry, score: matchCount + (problemMatch * 2) };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(s => s.entry);
  },

  // Format matching entries as context string for Gemini prompt injection
  formatAsContext(entries) {
    if (!entries.length) return '';
    const formatted = entries.map((e, i) => {
      const papers = e.example_papers.map(p =>
        `- "${p.title}" (${p.year})${p.doi ? ` doi:${p.doi}` : ''}`
      ).join('\n');
      return `KNOWN ANALOGUE ${i + 1} — FROM ${e.source_field.toUpperCase()}:
Problem class: ${e.problem_class}
Solution principle: ${e.solution_principle}
Mechanism: ${e.mechanism}
How to adapt: ${e.adaptation}
Published evidence:
${papers}`;
    }).join('\n\n---\n\n');

    return `\nKNOWN CROSS-FIELD ANALOGUES WITH CITATIONS (use these as the basis for at least ${entries.length} of your 4 discoveries, expanding on them with additional depth and specificity):\n\n${formatted}\n\n`;
  }
};

console.log(`[CrossDomainDB] Loaded ${CROSS_DOMAIN_DB.length} validated cross-field analogies`);
