# MBK Tech Studio Blogs

https://blogs.mbktechstudio.com/

Website Source Code
[danielcgilibert/blog-template](https://github.com/danielcgilibert/blog-template)

Documentation: [danielcgilibert/blog-template/README.md](https://github.com/danielcgilibert/blog-template/blob/main/README.md)

See Project Configs: [GPL 3.0 LICENSE](public/admin/doc.Config.md)

## 💻 Demo

Check out the [Demo](https://blog-template-gray.vercel.app/), hosted on Vercel
<br/>

https://github.com/danielcgilibert/blog-template/assets/44746462/56b8399e-cc5b-45a8-b9d2-d69833ecadb1

### NOTE:

Only The Source Code Of This Website Is Covered Under The [GPL 3.0 LICENSE](LICENSE). The Project Blog Posts, Some Images, , And Other Content Are NOT Covered Under This License And Remain The Intellectual Property Of The Author.

## 📐 Configure

- Edit the configuration file **src/data/site.config.ts** for the basic blog metadata.
- Update the **astro.config.mjs** file at the root of the project with your own domain.
- Modify the files in the **/public** folder:
  - favicon
  - robots.txt -> update the Sitemap url to your own domain
  - open-graph -> the open-graph is the image that will be displayed when sharing the blog link. For posts, the preview image is the post cover.
- Edit the social networks in the Header component - **src/components/Header.astro**, change the URL to your social network.

## 🗂️ Adding a category

To add a new category to your blog, simply go to the src/data/categories.ts file and add it to the array.

Example:

```ts
export  const  CATEGORIES  =  [
'JavaScript',
'React',
'new category here'  <---
]  as  const
```

> 🚨 Zod checks whether the category is not correctly written or does not exist in the properties of the markdown document. **It will throw an error when building the application.** 🚨

### List Of Main Domains

|                      | Domains                                        | Purpose                                                                                                |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Main Domain**      | [mbktechstudio.com](https://mbktechstudio.com) | Main Domain Used For all purposes for personal and official                                            |
| **Secondary Domain** | [mbktech.xyz](https://mbktech.xyz)             | Backup domain, rarely used.                                                                            |
| **Portfolio Domain** | [ibnekhalid.me](https://ibnekhalid.me)         | The primary website for my personal portfolio, domain was provided as part of the GitHub Student Pack. |

### List Of mbktechstudio.com sub domains

| **Repository Name**        | **Repo Link**                                                                                              | **Website Link**                                                                       | **Purpose**                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Main Website**           | [MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/MIbnEKhalid.github.io)                              | [mbktechstudio.com](https://mbktechstudio.com)                                         | Main Page of MBK Tech Studio                                                     |
| **Maintenance Website**    | [MIbnEKhalid.github.io/Maintenance](https://github.com/MIbnEKhalid/MIbnEKhalid.github.io/tree/Maintenance) | [mbktechstudio.com](https://mbktechstudio.com)                                         | Maintenance page deploy when websiye under Maintenance                           |
|                            |                                                                                                            | [maintenance.mbktechstudio.com](https://maintenance.mbktechstudio.com)                 |                                                                                  |
|                            |                                                                                                            | [maintenance-mbktechstudio.netlify.app](https://maintenance-mbktechstudio.netlify.app) |                                                                                  |
| **Domain Website**         | [MIbnEKhalid.github.io/domain](https://github.com/MIbnEKhalid/MIbnEKhalid.github.io/tree/domain)           | [domain.mbktechstudio.com](https://domain.mbktechstudio.com)                           | Website that showcase all subdomains)                                            |
|                            |                                                                                                            | [domains.mbktechstudio.com](https://domains.mbktechstudio.com)                         |                                                                                  |
|                            |                                                                                                            | [domain-mbktechstudio.netlify.app](https://domain-mbktechstudio.netlify.app)           |                                                                                  |
| **Main Test Website**      | [MIbnEKhalid.github.io/test](https://github.com/MIbnEKhalid/MIbnEKhalid.github.io/tree/test)               | [test.mbktechstudio.com](https://test.mbktechstudio.com)                               | Main Website Test Page                                                           |
|                            |                                                                                                            | [test-mbktechstudio.netlify.app](https://test-mbktechstudio.netlify.app)               |                                                                                  |
| **Privacy Policy Website** | [Privacy.MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/Privacy.MIbnEKhalid.github.io)              | [privacy.mbktechstudio.com](https://Privacy.mbktechstudio.com)                         | Website for Privacy Policy                                                       |
|                            |                                                                                                            | [privacy-mbktechstudio.netlify.app](https://privacy-mbktechstudio.netlify.app)         |                                                                                  |
| **Docs Website**           | [Docs.MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/Docs.MIbnEKhalid.github.io)                    | [Docs.mbktechstudio.com](https://docs.mbktechstudio.com)                               | Website for documentation of MBK Tech Studio's Projects, Products and apps (etc) |
|                            |                                                                                                            | [project.mbktechstudio.com](https://Project.mbktechstudio.com)                         |                                                                                  |
|                            |                                                                                                            | [docs-mbktechstudio.netlify.app](https://docs-mbktechstudio.netlify.app)               |                                                                                  |
| **Portal Website**         | [Portal.MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/Portal.MIbnEKhalid.github.io)                | [portal.mbktechstudio.com](https://portal.mbktechstudio.com)                           | Website For Admins and Test Users                                                |
|                            |                                                                                                            | [portal-mbktechstudio.netlify.app](https://portal-mbktechstudio.netlify.app)           |                                                                                  |
| **Portfolio Website**      | [Portfolio.MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/Portal.MIbnEKhalid.github.io)             | [portfolio.mbktechstudio.com](https://portfolio.mbktechstudio.com)                     | My Personal Portfolio Website                                                    |
|                            |                                                                                                            | [ibnekhalid.me](https://ibnekhalid.me)                                                 |                                                                                  |
|                            |                                                                                                            | [portfolio-mbktechstudio.netlify.app](https://portfolio-mbktechstudio.netlify.app)     |                                                                                  |
| **Uni Library Website**    | [Unilib.MIbnEKhalid.github.io](https://github.com/MIbnEKhalid/Unilib.MIbnEKhalid.github.io)                | [unilib.mbktechstudio.com](https://unilib.mbktechstudio.com)                           | Website For My Uni Classmates                                                    |
|                            |                                                                                                            | [unilib-mbktechstudio.netlify.app](https://unilib-mbktechstudio.netlify.app)           |                                                                                  |

**Note:** `mibnekhalid.github.io`, `privacy-mbktechstudio.netlify.app`, `docs-mbktechstudio.netlify.app`, `portal-mbktechstudio.netlify.app`, `portfolio-mbktechstudio.netlify.app`, `unilib-mbktechstudio.netlify.app`, `test-mbktechstudio.netlify.app`, `domain-mbktechstudio.netlify.app` and `maintenance-mbktechstudio.netlify.app` are original domains. The `mbktechstudio.com` domain is a custom domains with CNAME records redirecting to the original domains.

[mbktechstudio.com](https://mbktechstudio.com/Support/?Project=requestbook)

## Hosting:

The Website (SubDomains Of MBKTechStudio) Is Hosted On Netlify.

## License

This project is licensed under the GPL 3.0- see the [LICENSE](LICENSE) file for details.

## Contact

For questions or contributions, please contact Muhammad Bin Khalid at [mbktechstudio.com/Support](https://mbktechstudio.com/Support/?Project=.MIbnEKhalid.github.io), [support@mbktechstudio.com](mailto:support@mbktechstudio.com) or [chmuhammadbinkhalid28.com](mailto:chmuhammadbinkhalid28.com).
