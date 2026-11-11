-- Phase 8: curated learning resources.
-- Only stable, official documentation / well-known learning-platform URLs are
-- shipped — no fabricated links. Skills without a confidently-known official
-- resource are intentionally left without one.

insert into public.learning_resources
  (skill_id, title, description, resource_type, url, provider, difficulty, duration_hours, tags)
select s.id, v.title, v.description, v.resource_type, v.url, v.provider, v.difficulty,
       v.duration_hours, v.tags::text[]
from (values
  -- languages
  ('javascript', 'JavaScript Guide — MDN', 'Mozilla''s complete JavaScript language guide.', 'documentation', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', 'MDN', 'beginner', 10, '{javascript,web}'),
  ('javascript', 'The Modern JavaScript Tutorial', 'From fundamentals to advanced topics with examples.', 'article', 'https://javascript.info/', 'javascript.info', 'beginner', 14, '{javascript,web}'),
  ('typescript', 'TypeScript Handbook', 'Official handbook: types, generics, modules and tooling.', 'documentation', 'https://www.typescriptlang.org/docs/', 'Microsoft', 'beginner', 10, '{typescript}'),
  ('python', 'The Python Tutorial', 'Official tutorial covering the language and standard library.', 'documentation', 'https://docs.python.org/3/tutorial/', 'Python Software Foundation', 'beginner', 12, '{python}'),
  ('java', 'Java Tutorials — Oracle', 'Official Oracle tutorials for the Java platform.', 'documentation', 'https://docs.oracle.com/javase/tutorial/', 'Oracle', 'intermediate', 14, '{java,jvm}'),
  ('c-plus-plus', 'cppreference', 'The most complete reference for the C++ language and standard library.', 'documentation', 'https://en.cppreference.com/w/', 'cppreference', 'intermediate', 14, '{cpp}'),
  ('c-sharp', 'C# documentation — Microsoft Learn', 'Official C# language and .NET documentation.', 'documentation', 'https://learn.microsoft.com/en-us/dotnet/csharp/', 'Microsoft', 'beginner', 12, '{csharp,dotnet}'),
  ('go', 'A Tour of Go', 'Interactive tour of the Go language, straight from the Go team.', 'course', 'https://go.dev/tour/', 'Google', 'beginner', 8, '{go}'),
  ('sql', 'SQLBolt', 'Interactive lessons with in-browser SQL exercises.', 'course', 'https://sqlbolt.com/', 'SQLBolt', 'beginner', 6, '{sql,database}'),
  ('html', 'HTML — MDN', 'Mozilla''s documentation for HTML elements and APIs.', 'documentation', 'https://developer.mozilla.org/en-US/docs/Web/HTML', 'MDN', 'beginner', 6, '{html,web}'),
  ('css', 'CSS — MDN', 'Mozilla''s documentation for CSS selectors, layout and animation.', 'documentation', 'https://developer.mozilla.org/en-US/docs/Web/CSS', 'MDN', 'beginner', 8, '{css,web}'),

  -- frontend
  ('reactjs', 'React Learn', 'Official interactive tutorial from the React team.', 'course', 'https://react.dev/learn', 'Meta', 'beginner', 12, '{react,frontend}'),
  ('nextjs', 'Next.js Documentation', 'Official docs for routing, rendering and the App Router.', 'documentation', 'https://nextjs.org/docs', 'Vercel', 'intermediate', 10, '{nextjs,react}'),
  ('vuejs', 'Vue.js Guide', 'Official progressive framework guide with examples.', 'documentation', 'https://vuejs.org/guide/introduction.html', 'Vue.js', 'beginner', 10, '{vue,frontend}'),
  ('angular', 'Angular Guide', 'Official Angular documentation and tutorial.', 'documentation', 'https://angular.dev/guide/overview', 'Google', 'intermediate', 12, '{angular,frontend}'),
  ('tailwindcss', 'Tailwind CSS Documentation', 'Official utility-first CSS framework docs.', 'documentation', 'https://tailwindcss.com/docs', 'Tailwind Labs', 'beginner', 6, '{tailwind,css}'),
  ('redux', 'Redux Essentials Tutorial', 'Official Redux tutorial: store, slices and async logic.', 'course', 'https://redux.js.org/tutorials/essentials/part-1', 'Redux', 'intermediate', 6, '{redux,state}'),
  ('responsive-design', 'Responsive Design — MDN Learn', 'Layout techniques for every screen size.', 'article', 'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design', 'MDN', 'beginner', 5, '{css,web}'),
  ('accessibility', 'Web Accessibility — MDN', 'Guides, standards and techniques for accessible sites.', 'documentation', 'https://developer.mozilla.org/en-US/docs/Web/Accessibility', 'MDN', 'beginner', 6, '{a11y,web}'),

  -- backend
  ('rest-apis', 'RESTful API Design', 'Guidelines and best practices for REST API designers.', 'article', 'https://restfulapi.net/', 'restfulapi.net', 'beginner', 4, '{rest,api}'),
  ('graphql', 'Learn GraphQL', 'Official interactive GraphQL tutorials.', 'course', 'https://graphql.org/learn/', 'GraphQL Foundation', 'beginner', 6, '{graphql,api}'),
  ('nodejs', 'Node.js Learn', 'Official guides: running JS on the server, modules and async I/O.', 'documentation', 'https://nodejs.org/en/learn', 'OpenJS Foundation', 'beginner', 10, '{node,backend}'),
  ('expressjs', 'Express.js Documentation', 'Official Node.js web framework documentation.', 'documentation', 'https://expressjs.com/', 'Express Foundation', 'beginner', 6, '{express,node}'),
  ('nestjs', 'NestJS Documentation', 'Official docs for the progressive Node.js framework.', 'documentation', 'https://docs.nestjs.com/', 'NestJS', 'intermediate', 10, '{nestjs,node}'),
  ('django', 'Django Documentation', 'Official docs including the tutorial and how-to guides.', 'documentation', 'https://docs.djangoproject.com/', 'Django Software Foundation', 'intermediate', 12, '{django,python}'),
  ('flask', 'Flask Documentation', 'Official quickstart and API reference for Flask.', 'documentation', 'https://flask.palletsprojects.com/', 'Pallets', 'beginner', 6, '{flask,python}'),
  ('fastapi', 'FastAPI Tutorial', 'Official step-by-step tutorial for FastAPI.', 'course', 'https://fastapi.tiangolo.com/tutorial/', 'FastAPI', 'beginner', 8, '{fastapi,python,api}'),
  ('spring-boot', 'Spring Guides', 'Official runnable guides for Spring Boot and the Spring ecosystem.', 'course', 'https://spring.io/guides', 'VMware', 'intermediate', 12, '{spring,java}'),
  ('microservices', 'Microservices Patterns', 'Pattern language for microservice architecture and delivery.', 'article', 'https://microservices.io/patterns/index.html', 'microservices.io', 'intermediate', 8, '{architecture}'),

  -- databases
  ('postgresql', 'PostgreSQL Tutorial', 'Official docs: SQL language, administration and extensions.', 'documentation', 'https://www.postgresql.org/docs/current/tutorial.html', 'PostgreSQL Global Development Group', 'beginner', 10, '{postgresql,sql}'),
  ('mysql', 'MySQL Documentation', 'Official MySQL reference manual and tutorials.', 'documentation', 'https://dev.mysql.com/doc/', 'Oracle', 'beginner', 10, '{mysql,sql}'),
  ('mongodb', 'MongoDB Manual — Tutorials', 'Official tutorials: CRUD, aggregation and indexing.', 'documentation', 'https://www.mongodb.com/docs/manual/tutorial/', 'MongoDB', 'beginner', 8, '{mongodb,nosql}'),
  ('redis', 'Redis Documentation', 'Official docs for commands, data types and clients.', 'documentation', 'https://redis.io/docs/latest/', 'Redis', 'beginner', 6, '{redis,caching}'),
  ('vector-databases', 'pgvector', 'Open-source vector similarity search for PostgreSQL.', 'documentation', 'https://github.com/pgvector/pgvector', 'GitHub', 'intermediate', 4, '{pgvector,embeddings}'),

  -- data
  ('pandas', 'Pandas Documentation', 'Official user guide: DataFrames, joins and time series.', 'documentation', 'https://pandas.pydata.org/docs/', 'pandas', 'beginner', 12, '{pandas,python}'),
  ('numpy', 'NumPy Documentation', 'Official quickstart and reference for ndarray operations.', 'documentation', 'https://numpy.org/doc/stable/', 'NumPy', 'beginner', 8, '{numpy,python}'),
  ('data-visualization', 'Matplotlib Tutorials', 'Official tutorials for charts, subplots and styling.', 'course', 'https://matplotlib.org/stable/tutorials/', 'Matplotlib', 'beginner', 8, '{visualization,python}'),
  ('excel', 'Excel help & learning — Microsoft', 'Official tutorials, formulas and pivot-table guides.', 'documentation', 'https://support.microsoft.com/en-us/excel', 'Microsoft', 'beginner', 8, '{excel,spreadsheet}'),
  ('power-bi', 'Power BI documentation — Microsoft Learn', 'Official docs for modelling, DAX and Power BI service.', 'documentation', 'https://learn.microsoft.com/en-us/power-bi/', 'Microsoft', 'intermediate', 10, '{powerbi,business-intelligence}'),
  ('tableau', 'Tableau Help', 'Official help centre: building views, calculations and dashboards.', 'documentation', 'https://help.tableau.com/', 'Salesforce', 'beginner', 8, '{tableau,visualization}'),
  ('statistics', 'An Introduction to Statistical Learning', 'Free textbook on statistical learning with R/Python labs.', 'book', 'https://www.statlearning.com/', 'ISLR authors', 'intermediate', 20, '{statistics,ml}'),
  ('data-cleaning', 'Missing data — pandas user guide', 'Official guide to null handling and imputation in pandas.', 'documentation', 'https://pandas.pydata.org/docs/user_guide/missing_data.html', 'pandas', 'beginner', 4, '{pandas,cleaning}'),
  ('etl', 'What is ETL? — AWS', 'Plain-language overview of extract-transform-load pipelines.', 'article', 'https://aws.amazon.com/what-is/etl/', 'AWS', 'beginner', 3, '{etl,data-engineering}'),
  ('data-modeling', 'Data modeling — Wikipedia', 'Overview of entity-relationship and dimensional modelling.', 'article', 'https://en.wikipedia.org/wiki/Data_modeling', 'Wikipedia', 'beginner', 5, '{modeling,database}'),
  ('big-data', 'Apache Hadoop', 'Official site for the Hadoop distributed computing platform.', 'documentation', 'https://hadoop.apache.org/', 'Apache Software Foundation', 'intermediate', 10, '{hadoop,spark}'),
  ('business-intelligence', 'Power BI fundamentals — Microsoft Learn', 'Intro path for BI concepts and building your first report.', 'course', 'https://learn.microsoft.com/en-us/power-bi/fundamentals/', 'Microsoft', 'beginner', 6, '{bi,reporting}'),

  -- ml & ai
  ('machine-learning', 'scikit-learn User Guide', 'Official tutorials: preprocessing, models, evaluation.', 'documentation', 'https://scikit-learn.org/stable/tutorial/', 'scikit-learn', 'beginner', 12, '{ml,python}'),
  ('deep-learning', 'PyTorch Tutorials', 'Official tutorials from tensors to training models.', 'course', 'https://pytorch.org/tutorials/', 'PyTorch', 'intermediate', 14, '{deep-learning,pytorch}'),
  ('tensorflow', 'TensorFlow Tutorials', 'Official tutorials for keras models and deployment.', 'course', 'https://www.tensorflow.org/tutorials', 'Google', 'intermediate', 12, '{tensorflow,ml}'),
  ('pytorch', 'PyTorch Tutorials', 'Official tutorials for tensors, autograd and neural networks.', 'course', 'https://pytorch.org/tutorials/', 'PyTorch', 'beginner', 12, '{pytorch,ml}'),
  ('nlp', 'Transformers documentation', 'Official Hugging Face docs for NLP models and pipelines.', 'documentation', 'https://huggingface.co/docs/transformers', 'Hugging Face', 'intermediate', 10, '{nlp,transformers}'),
  ('computer-vision', 'OpenCV Tutorials', 'Official OpenCV tutorials for image processing and vision.', 'course', 'https://docs.opencv.org/', 'OpenCV', 'intermediate', 10, '{opencv,vision}'),
  ('llm', 'Gemini API documentation', 'Official Google docs for the Gemini API and prompting guides.', 'documentation', 'https://ai.google.dev/gemini-api/docs', 'Google', 'intermediate', 8, '{llm,genai}'),
  ('mlops', 'MLflow Documentation', 'Official docs for experiment tracking, models and deployment.', 'documentation', 'https://mlflow.org/', 'Linux Foundation', 'intermediate', 8, '{mlops,mlflow}'),
  ('experimentation', 'A/B testing — Wikipedia', 'Overview of controlled experiments and common pitfalls.', 'article', 'https://en.wikipedia.org/wiki/A/B_testing', 'Wikipedia', 'beginner', 3, '{experimentation,statistics}'),
  ('ethical-ai', 'AI Risk Management Framework — NIST', 'NIST framework for governing and managing AI risk.', 'documentation', 'https://www.nist.gov/itl/ai-risk-management-framework', 'NIST', 'intermediate', 6, '{ai-governance,policy}'),

  -- tooling
  ('git', 'Pro Git book', 'Free full book on Git internals, branching and workflows.', 'book', 'https://git-scm.com/book/en/v2', 'Scott Chacon & Ben Straub', 'beginner', 10, '{git,version-control}'),
  ('testing', 'pytest documentation', 'Official docs: fixtures, parametrisation and markers.', 'documentation', 'https://docs.pytest.org/', 'pytest', 'beginner', 6, '{testing,python}'),
  ('agile', 'Manifesto for Agile Software Development', 'The four values and twelve principles behind agile.', 'article', 'https://agilemanifesto.org/', 'Agile Alliance', 'beginner', 2, '{agile,process}'),
  ('system-design', 'System Design Primer', 'Structured repo covering scalability interview topics.', 'article', 'https://github.com/donnemartin/system-design-primer', 'GitHub', 'intermediate', 12, '{architecture,scalability}'),
  ('kafka', 'Apache Kafka Introduction', 'Official intro to topics, producers, consumers and streams.', 'documentation', 'https://kafka.apache.org/intro', 'Apache Software Foundation', 'intermediate', 6, '{kafka,messaging}'),

  -- devops
  ('docker', 'Docker Get Started', 'Official hands-on guide: images, containers and volumes.', 'course', 'https://docs.docker.com/get-started/', 'Docker', 'beginner', 8, '{docker,containers}'),
  ('kubernetes', 'Kubernetes Documentation', 'Official docs: objects, workloads and cluster operations.', 'documentation', 'https://kubernetes.io/docs/home/', 'CNCF', 'intermediate', 12, '{kubernetes,containers}'),
  ('aws', 'AWS Documentation', 'Official docs for every AWS service.', 'documentation', 'https://aws.amazon.com/documentation/', 'Amazon Web Services', 'intermediate', 14, '{aws,cloud}'),
  ('azure', 'Azure documentation — Microsoft Learn', 'Official docs and learning paths for Azure.', 'documentation', 'https://learn.microsoft.com/en-us/azure/', 'Microsoft', 'intermediate', 12, '{azure,cloud}'),
  ('gcp', 'Google Cloud Documentation', 'Official docs for GCP services and architectures.', 'documentation', 'https://cloud.google.com/docs', 'Google', 'intermediate', 12, '{gcp,cloud}'),
  ('cicd', 'GitHub Actions documentation', 'Official docs for workflows, runners and secrets.', 'documentation', 'https://docs.github.com/en/actions', 'GitHub', 'beginner', 6, '{cicd,automation}'),
  ('terraform', 'Terraform Documentation', 'Official docs: language, providers and state.', 'documentation', 'https://developer.hashicorp.com/terraform/docs', 'HashiCorp', 'intermediate', 8, '{terraform,iac}'),
  ('linux', 'Linux topics — Red Hat', 'Guides and articles on Linux administration concepts.', 'documentation', 'https://www.redhat.com/en/topics/linux', 'Red Hat', 'beginner', 8, '{linux,ops}'),
  ('bash', 'GNU Bash Reference Manual', 'Official reference for the bash shell and scripting.', 'documentation', 'https://www.gnu.org/software/bash/manual/', 'GNU', 'beginner', 6, '{bash,shell}'),
  ('monitoring', 'Prometheus Documentation', 'Official docs: metrics, PromQL and alerting.', 'documentation', 'https://prometheus.io/docs/introduction/overview/', 'CNCF', 'intermediate', 8, '{prometheus,observability}'),
  ('networking', 'Cloudflare Learning Center — Networking', 'Plain-language guides on DNS, HTTP, TCP/IP and more.', 'article', 'https://www.cloudflare.com/learning/', 'Cloudflare', 'beginner', 6, '{networking,internet}'),

  -- security
  ('cybersecurity', 'Cybersecurity resources — CISA', 'Official advisories, guides and best practices from CISA.', 'documentation', 'https://www.cisa.gov/cybersecurity', 'CISA', 'beginner', 6, '{security,defence}'),
  ('network-security', 'Firewall — Wikipedia', 'Overview of firewall types, zones and traffic filtering.', 'article', 'https://en.wikipedia.org/wiki/Firewall_(computing)', 'Wikipedia', 'beginner', 3, '{firewall,networking}'),
  ('siem', 'Security information and event management — Wikipedia', 'Overview of SIEM architecture and use cases.', 'article', 'https://en.wikipedia.org/wiki/Security_information_and_event_management', 'Wikipedia', 'intermediate', 4, '{siem,monitoring}'),
  ('vulnerability-assessment', 'OWASP Web Security Testing Guide', 'Systematic web-app security testing checklist.', 'documentation', 'https://owasp.org/www-project-web-security-testing-guide/', 'OWASP', 'intermediate', 10, '{pentesting,owasp}'),
  ('incident-response', 'Incident response — Wikipedia', 'Overview of preparation, detection, containment and recovery.', 'article', 'https://en.wikipedia.org/wiki/Incident_response', 'Wikipedia', 'beginner', 3, '{ir,operations}'),
  ('owasp', 'OWASP Top Ten', 'The standard awareness document for critical web risks.', 'documentation', 'https://owasp.org/www-project-top-ten/', 'OWASP', 'beginner', 4, '{owasp,web-security}'),
  ('iam', 'IAM documentation — AWS', 'Official docs for users, roles, policies and least privilege.', 'documentation', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/', 'Amazon Web Services', 'intermediate', 6, '{iam,security}')
) as v(skill_slug, title, description, resource_type, url, provider, difficulty, duration_hours, tags)
join public.skills s on s.slug = v.skill_slug;
