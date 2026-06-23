export type OutreachLandingPage = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  heroLead: string;
  audience: string;
  primaryCta: string;
  secondaryCta: string;
  proofLabel: string;
  proofTitle: string;
  proofCopy: string;
  painPoints: string[];
  outcomes: Array<{
    title: string;
    copy: string;
  }>;
  checklist: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

export const outreachLandingPages: OutreachLandingPage[] = [
  {
    slug: 'for-community-races',
    eyebrow: 'For community races',
    title: 'A clearer race website for hometown events, charity runs, and local road races.',
    description:
      'StartLine Sites builds fast, SEO-optimized websites for community races that need clearer registration paths, race-day details, sponsor visibility, and mobile trust.',
    heroLead:
      'Community races often have the strongest local story and the thinnest website layer. StartLine Sites helps organize the details runners, sponsors, volunteers, and city partners need before they click through to register.',
    audience: '5Ks, 10Ks, half marathons, charity runs, local road races, and annual community events.',
    primaryCta: 'Request a community race audit',
    secondaryCta: 'Review the race website checklist',
    proofLabel: 'Community template fit',
    proofTitle: 'Keep the event approachable while making registration easier to find.',
    proofCopy:
      'The Community template focuses on schedule, parking, packet pickup, local story, sponsor context, volunteer calls-to-action, and a direct route to the registration platform you already use.',
    painPoints: [
      'Race-day details exist, but runners have to scan multiple pages, PDFs, or social posts to find them.',
      'Sponsor and charity value is present, but not explained in a polished runner-facing section.',
      'The main registration button is easy to miss on mobile or appears after too many competing links.'
    ],
    outcomes: [
      {
        title: 'A mobile-first homepage',
        copy: 'Put date, location, distances, pricing windows, and the register CTA where runners expect them.'
      },
      {
        title: 'Fewer repeat questions',
        copy: 'Group packet pickup, parking, course, volunteer, and policy answers before race-week email volume spikes.'
      },
      {
        title: 'Better sponsor visibility',
        copy: 'Give local partners and charities a cleaner presence without cluttering the path to registration.'
      }
    ],
    checklist: [
      'Registration CTA above the fold and repeated after logistics sections.',
      'Schedule, parking, packet pickup, course, FAQ, volunteer, and sponsor content organized for mobile.',
      'GA4/Search Console ownership and registration click tracking set up for the race team.',
      'Race-week update area ready before urgent changes need to be posted.'
    ],
    faq: [
      {
        question: 'Do community races need a custom website if registration already lives elsewhere?',
        answer:
          'Often, yes. The registration platform can handle checkout while a dedicated race website handles story, local trust, logistics, sponsor context, SEO, and the path into registration.'
      },
      {
        question: 'Can StartLine work with limited photos or sponsor assets?',
        answer:
          'Yes. The private audit can identify what is ready now, what can be improved later, and where a clean content structure matters more than having perfect assets on day one.'
      }
    ]
  },
  {
    slug: 'for-marathons',
    eyebrow: 'For marathons and half marathons',
    title: 'A race website built for runners comparing course trust, logistics, and registration timing.',
    description:
      'StartLine Sites builds fast, SEO-optimized marathon and half marathon websites that clarify course details, logistics, registration CTAs, and runner trust signals.',
    heroLead:
      'Marathoners compare more than a checkout page. They look for course proof, timing, travel details, pacers, certification notes, policies, and whether the race feels organized enough to commit months ahead.',
    audience: 'Marathons, half marathons, certified road races, BQ-focused events, and multi-distance race weekends.',
    primaryCta: 'Request a marathon site audit',
    secondaryCta: 'See checklist areas',
    proofLabel: 'Performance template fit',
    proofTitle: 'Bring course confidence and registration clarity into one focused runner path.',
    proofCopy:
      'The Performance template is built for clear course information, certification or qualifying context where applicable, pacer and timing details, travel notes, and repeated registration calls-to-action.',
    painPoints: [
      'Course, elevation, pacer, certification, and schedule details are split across PDFs or dated updates.',
      'Runners cannot quickly tell whether the race fits their goal, travel plan, or registration timeline.',
      'Important trust signals are present, but they appear after generic copy or low-priority links.'
    ],
    outcomes: [
      {
        title: 'Course proof up front',
        copy: 'Surface distance, location, terrain, certification notes, pace support, and map details without overstating outcomes.'
      },
      {
        title: 'Cleaner travel planning',
        copy: 'Group lodging, parking, expo, packet pickup, road closure, and spectator details in a predictable structure.'
      },
      {
        title: 'Tracked registration intent',
        copy: 'Measure clicks from course, pricing, FAQ, and schedule sections into the registration platform.'
      }
    ],
    checklist: [
      'Race name, year, location, distance, and registration status are clear in the first screen.',
      'Course, elevation, certification, timing, pacer, and aid station details are factual and easy to find.',
      'Travel/logistics content is grouped instead of scattered across old announcements.',
      'FAQ answers cover refunds, transfers, deferrals, weather, packet pickup, and race-week changes.'
    ],
    faq: [
      {
        question: 'Will StartLine make BQ or PR claims for our race?',
        answer:
          'Only when they are factual and supportable. StartLine copy should clarify certification, course profile, and runner-relevant details without guaranteeing results.'
      },
      {
        question: 'Can the registration platform stay in place?',
        answer:
          'Yes. StartLine improves the public race website layer and sends runners to the existing registration platform through clearer, tracked calls-to-action.'
      }
    ]
  },
  {
    slug: 'for-runsignup-races',
    eyebrow: 'For RunSignup races',
    title: 'A stronger marketing layer around your existing RunSignup registration flow.',
    description:
      'StartLine Sites helps RunSignup races keep checkout in place while adding a faster, SEO-optimized website layer for trust, logistics, sponsors, and tracked registration clicks.',
    heroLead:
      'RunSignup can remain the registration and payment system. StartLine Sites builds the race website layer around it: search-friendly pages, clearer event context, sponsor value, FAQ answers, and direct tracked links into registration.',
    audience: 'Race directors using RunSignup who want stronger SEO, storytelling, sponsor visibility, and mobile-first race details.',
    primaryCta: 'Request a RunSignup race audit',
    secondaryCta: 'Read the checklist',
    proofLabel: 'No platform switch required',
    proofTitle: 'Keep RunSignup for checkout. Use StartLine for the pre-registration decision path.',
    proofCopy:
      'The goal is not to replace your registration platform. The goal is to make more of the runner-facing context indexable, organized, fast, and measurable before the final click into RunSignup.',
    painPoints: [
      'The registration listing is doing too much work as the homepage, sales page, FAQ, and sponsor page.',
      'Search content, local story, and race logistics are thinner than what runners need before committing.',
      'The race team cannot easily see which website sections are sending serious runners into registration.'
    ],
    outcomes: [
      {
        title: 'SEO pages before checkout',
        copy: 'Create a crawlable race website with clear event language, schema-friendly structure, and internal paths.'
      },
      {
        title: 'Cleaner runner decisions',
        copy: 'Explain course, schedule, pricing windows, FAQs, sponsors, and race-week updates before sending runners to RunSignup.'
      },
      {
        title: 'Tracked outbound clicks',
        copy: 'Separate registration CTA clicks from general outbound links so the race team can understand intent.'
      }
    ],
    checklist: [
      'Primary CTAs link to the right RunSignup page and use consistent wording.',
      'Registration, donation, volunteer, results, and transfer paths are not competing with each other.',
      'Event details on the website match the RunSignup listing and race-week emails.',
      'Analytics can distinguish RunSignup registration clicks from other outbound traffic.'
    ],
    faq: [
      {
        question: 'Do we have to leave RunSignup?',
        answer:
          'No. StartLine is designed to work as the marketing site in front of the platform you already use for registration, payment, donations, and participant management.'
      },
      {
        question: 'Can StartLine deep-link to specific RunSignup actions?',
        answer:
          'Yes, when the public links are available. CTAs can point to registration, donation, volunteer, results, or race info paths while keeping the main registration step prioritized.'
      }
    ]
  },
  {
    slug: 'for-race-directors',
    eyebrow: 'For race directors',
    title: 'Race websites built to turn interest into registrations without replacing your operations stack.',
    description:
      'StartLine Sites gives race directors fast, SEO-optimized websites that clarify registration, logistics, sponsors, analytics, and race-week updates.',
    heroLead:
      'Race directors already manage permits, sponsors, volunteers, vendors, registration, email, and race-week pressure. The website should make that job easier by answering runner questions earlier and moving serious interest toward registration.',
    audience: 'Race directors, event producers, nonprofit race teams, timing partners, and endurance event organizers.',
    primaryCta: 'Request a private audit',
    secondaryCta: 'Use the race website checklist',
    proofLabel: 'Director-first scope',
    proofTitle: 'A practical website layer for search, speed, signups, and race-week clarity.',
    proofCopy:
      'StartLine focuses on what race directors need the site to do: explain the event, reduce avoidable questions, support sponsors, measure intent, and send runners to the existing registration path.',
    painPoints: [
      'Important race details are scattered across the website, registration platform, PDFs, social posts, and email updates.',
      'The site is hard to update or hard to trust on mobile when runner questions increase.',
      'Sponsors, charities, and community partners need visibility, but the runner path still has to stay clear.'
    ],
    outcomes: [
      {
        title: 'Registration clarity',
        copy: 'Make the next step obvious without changing the platform that already handles checkout.'
      },
      {
        title: 'Operational calm',
        copy: 'Give runners one reliable place to find schedule, packet pickup, parking, policies, and updates.'
      },
      {
        title: 'Stakeholder confidence',
        copy: 'Show sponsors, partners, and community value in a polished structure the race team can reference.'
      }
    ],
    checklist: [
      'Homepage explains who the race is for, when it happens, where it happens, and how to register.',
      'The site owner controls GA4, Search Console, domain, and critical account access.',
      'Sponsor, charity, volunteer, and community partner sections are current and mobile-friendly.',
      'Race-week update process is clear before weather, parking, or schedule changes happen.'
    ],
    faq: [
      {
        question: 'What does the private audit include?',
        answer:
          'StartLine reviews the current race website like a runner, identifies the clearest opportunities, and recommends a next move only when there is a practical fit.'
      },
      {
        question: 'Is this a one-time package?',
        answer:
          'No. Public packages are one-time first-year race-cycle packages. Optional scoped services can be considered after year one when the race needs them.'
      }
    ]
  }
];

export const outreachLandingPageBySlug = new Map(
  outreachLandingPages.map((page) => [page.slug, page])
);
