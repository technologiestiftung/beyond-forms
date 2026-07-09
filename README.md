![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-8-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

# BeyondForms

## Description

_Beyond Forms_ is a two-year research project exploring how the application process between citizens and public administration can be improved for both sides with the help of artificial intelligence – and what it means to truly move beyond the classic digital form.

The vision behind the name: In the future, citizens could apply for public services with the help of an AI agent without having to fill out a form. Instead, an intelligent system would guide them through the process – clearly, proactively, and tailored to their individual life situation.

Concrete goals include:

- **Easier access** to public services, especially for disadvantaged and vulnerable groups
- **Reduced workload** for administrative staff and relief from high communication volumes
- **Shorter processing times** through more complete and better structured applications
- **New access pathways** beyond text-based forms
- **Proactive and personalized** recommendations for services that match citizens’ life situations

## Funding Disclosure

The project is funded by [Google.org](google.org), Google’s philanthropic arm: [Google.org](google.org) is providing financial support for the project and was supporting it through a fellowship program. An interdisciplinary team of Google employees assisted CityLAB Berlin with the technical implementation for a period of six months from January until July 2026. In addition, [Google.org](google.org) is supporting the project with a grant of one million US dollars, which will enable the development and testing of prototype solutions within the project.

CityLAB Berlin will continue the project independently until the end of 2027.

# Development Information

## Deployment

Services are deployed from the `services/` folder.
To automate the deployment of a new service, it needs to be added to `ci.yaml`.

- **Staging Deployment**: Once merged to the `main` branch, the service will automatically be built and deployed to the staging environment.
- **Production Deployment**: Production deployments happen from the `prod` branch. The codebase is automatically promoted from `main` to `prod` (triggering a production rollout) via the `.github/workflows/promote-to-prod.yaml` workflow if the staging E2E audit tests pass. Alternatively, you can manually merge `main` into `prod`.

Additionally, a folder named `infrastructure` is mandatory inside each service. This folder must contain a `cloudbuild.yaml` file with a deploy command and the necessary variable names (which are automatically injected from GitHub secrets from this repository). By following this structure, the service will automatically be deployed to Cloud Run with a `bf-stg-` or `bf-prd-` prefix depending on the environment.

## Local Development

Please refer to the detailed instructions in [DEVELOPMENT.md](DEVELOPMENT.md) for how to set up the project locally. It includes instructions on bootstrapping the environment variables, setting up the Docker network, and spinning up the required infrastructure using `docker compose`.

## Credits

<table>
  <tr>
    <td>
      Made by <a href="https://citylab-berlin.org/de/start/">
        <br />
        <br />
        <img width="200" src="https://citylab-berlin.org/app/themes/flynt-citylab/dist/assets/logo-T6_mdScd.svg" alt="Link to the CityLAB Berlin website" />
      </a>
    </td>
    <td>
      A project by <a href="https://www.technologiestiftung-berlin.de/">
        <br />
        <br />
        <img width="150" src="https://logos.citylab-berlin.org/logo-technologiestiftung-berlin-de.svg" alt="Link to the Technologiestiftung Berlin website" />
      </a>
    </td>
    <td>
      Supported by <a href="https://www.berlin.de/rbmskzl/">
        <br />
        <br />
        <img width="80" src="https://logos.citylab-berlin.org/logo-berlin-senatskanzelei-de.svg" alt="Link to the Senate Chancellery of Berlin"/>
      </a>
    </td>
    <td>
      Supported by <a href="https://google.org/">
        <br />
        <br />
        <img width="200" src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Google_org_logo.svg" alt="Link to the Google.org website"/>
      </a>
    </td>
  </tr>
</table>

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/malte-b"><img src="https://avatars.githubusercontent.com/u/27922183?v=4?s=64" width="64px;" alt="Malte Barth"/><br /><sub><b>Malte Barth</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=malte-b" title="Code">💻</a> <a href="#data-malte-b" title="Data">🔣</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=malte-b" title="Documentation">📖</a> <a href="#ideas-malte-b" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-malte-b" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-malte-b" title="Maintenance">🚧</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Amalte-b" title="Reviewed Pull Requests">👀</a> <a href="#userTesting-malte-b" title="User Testing">📓</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=malte-b" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/aeschi"><img src="https://avatars.githubusercontent.com/u/56318362?v=4?s=64" width="64px;" alt="aeschi"/><br /><sub><b>aeschi</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=aeschi" title="Code">💻</a> <a href="#a11y-aeschi" title="Accessibility">️️️️♿️</a> <a href="#maintenance-aeschi" title="Maintenance">🚧</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Aaeschi" title="Reviewed Pull Requests">👀</a> <a href="#design-aeschi" title="Design">🎨</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=aeschi" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nlspnsgen"><img src="https://avatars.githubusercontent.com/u/12913491?v=4?s=64" width="64px;" alt="nlspnsgen"/><br /><sub><b>nlspnsgen</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=nlspnsgen" title="Code">💻</a> <a href="#maintenance-nlspnsgen" title="Maintenance">🚧</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Anlspnsgen" title="Reviewed Pull Requests">👀</a> <a href="#infra-nlspnsgen" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#security-nlspnsgen" title="Security">🛡️</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=nlspnsgen" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mms789"><img src="https://avatars.githubusercontent.com/u/254668140?v=4?s=64" width="64px;" alt="Magda"/><br /><sub><b>Magda</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=mms789" title="Code">💻</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Amms789" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=mms789" title="Tests">⚠️</a> <a href="#ideas-mms789" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/janinarenk"><img src="https://avatars.githubusercontent.com/u/12065659?v=4?s=64" width="64px;" alt="Janina Renk"/><br /><sub><b>Janina Renk</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=janinarenk" title="Code">💻</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Ajaninarenk" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=janinarenk" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://oreflow.com/"><img src="https://avatars.githubusercontent.com/u/1454151?v=4?s=64" width="64px;" alt="Tim Malmström"/><br /><sub><b>Tim Malmström</b></sub></a><br /><a href="https://github.com/technologiestiftung/beyondforms/commits?author=oreflow" title="Code">💻</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Aoreflow" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=oreflow" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://nikolai.one/"><img src="https://avatars.githubusercontent.com/u/234851?v=4?s=64" width="64px;" alt="Nikolai Danylchyk"/><br /><sub><b>Nikolai Danylchyk</b></sub></a><br /><a href="#mentoring-kennycoder" title="Mentoring">🧑‍🏫</a> <a href="#infra-kennycoder" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#security-kennycoder" title="Security">🛡️</a> <a href="#tutorial-kennycoder" title="Tutorials">✅</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=kennycoder" title="Code">💻</a> <a href="https://github.com/technologiestiftung/beyondforms/pulls?q=is%3Apr+reviewed-by%3Akennycoder" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/technologiestiftung/beyondforms/commits?author=kennycoder" title="Tests">⚠️</a> <a href="#ideas-kennycoder" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://www.awsm.de/"><img src="https://avatars.githubusercontent.com/u/434355?v=4?s=64" width="64px;" alt="Ingo Hinterding"/><br /><sub><b>Ingo Hinterding</b></sub></a><br /><a href="#projectManagement-Esshahn" title="Project Management">📆</a> <a href="#business-Esshahn" title="Business development">💼</a> <a href="#ideas-Esshahn" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
