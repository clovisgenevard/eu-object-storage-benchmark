# EU Cloud Computing Price Benchmarks

Published cloud prices are not comparable as printed. Vendors quote different units, over
different months, in different currencies, and the headline rate leaves out the charges that
often dominate the bill. This repository normalises them — **euros per GiB per month on a
730-hour basis**, Frankfurt region or the closest each vendor operates — and publishes each
comparison as a single dependency-free HTML page with an adjustable total-cost scenario.

| Benchmark | Covers | Rows | Observed |
|---|---|---|---|
| [**Object storage**](object-storage/) | S3-compatible buckets, from AWS S3 Standard to Glacier Deep Archive | 36 vendor × class | 2026-09-07 |
| [**Block storage**](block-storage/) | EBS-shaped volumes — attachable, resizable, snapshottable | 37 vendor × class | 2026-09-10 |
| [**Managed PostgreSQL**](managed-postgresql/) | Managed PostgreSQL priced for a workload you define, from AWS RDS to the European clouds and Aiven on six clouds | 17 offers | 2026-09-21 |

Published readings: **https://retrack.github.io/eu-cloud-computing-price-benchmarks/**

Or open any `<benchmark>/index.html` from a clone. Nothing to install, no build step required
to view it, no network calls beyond a web font.

A reading more than a month old should not be trusted — see *Refreshing the data*.

## Why normalisation is the point

Three things differ between vendors and quietly move the figure by 10 % or more:

1. **The unit.** AWS, Azure, Google, Exoscale and Wasabi bill in binary units
   (1 GB = 2³⁰ bytes) while printing "GB". Hetzner, Backblaze, Scaleway, IONOS, Cloudflare,
   Infomaniak and STACKIT state no basis at all. Decimal versus binary is a 7.4 % difference
   on the same physical bytes. OVHcloud prints `GiB` for object storage and `GB` for block
   storage, defining neither.
2. **The month.** Vendors that bill hourly extrapolate to a month using 720, 730 or 744 hours
   depending on who is doing the extrapolating — a 3 % spread on its own. IONOS and STACKIT
   publish a 30-day month; OVHcloud publishes a 730-hour one.
3. **What the headline excludes.** For object storage: egress, requests, retrieval fees,
   minimum durations and minimum billable object sizes. For block storage: provisioned IOPS,
   provisioned throughput and snapshots — which at AWS io2 can cost four times the capacity
   itself.

Every benchmark here fixes all three: one hour basis, one unit, one currency, and a
total-cost scenario alongside the per-GiB figure.

## House rules

These hold across every benchmark in the repository:

- **One basis, stated on the page** — 730 h/month (annual average), euros, excluding VAT,
  with the ECB reference rate and its date stamped in the page header. Every dataset carries
  the same rate; two pages must never quote different ones on the same day.
- **Physical units, not billing units** — decimal-unit vendors are multiplied by
  1.073741824, so the comparison is per unit of what you actually get.
- **Volume tiers are applied tier by tier**, never at an average rate.
- **Nothing is estimated.** A charge a vendor does not publish is shown as *not published*,
  and any scenario total missing a component is prefixed `≥` rather than being quietly
  treated as zero. Rows whose vendor does not state a unit basis carry a △ marker and follow
  the page's unit selector.
- **Regions are labelled per row.** Where a vendor has no equivalent of the reference region,
  the row says which region it actually is.
- **Assumptions are adjustable.** Volumes, the hour basis and the treatment of undefined
  units are controls on the page, not decisions baked into a number.
- **Capability gaps are not discounts.** A vendor that cannot deliver the scenario is marked,
  not ranked first for being cheap; a product a vendor does not offer is absent, not free.

Each benchmark's own README states the conventions particular to it, and its known gaps.

## Architecture

A benchmark is a folder. Everything generic lives in `shared/` and is used by all of them;
everything product-specific lives in the folder. The two pages are deliberately **separate
pages, not two tabs of one** — the products are bought by different people for different
reasons, the cost drivers do not overlap, and merging the scenarios would produce a control
panel nobody could read. They share the look, the machinery and the tooling; they do not
share a dataset or a cost model.

| Path | Role |
|---|---|
| `shared/shell.html` | the document skeleton every page is poured into |
| `shared/base.css` | tokens, layout, controls, tabs, ranking chart, table |
| `shared/ui.js` | units, currency, formatting, the ranking renderer, sorting, control wiring |
| `<benchmark>/meta.json` | title, description, the date the prices were read |
| `<benchmark>/data.js` | the dataset — one entry per vendor × class |
| `<benchmark>/page.html` | the body markup: header, controls, table head, notes, sources |
| `<benchmark>/page.js` | the cost model, the renderers and the wiring calls |
| `<benchmark>/style.css` | product-specific CSS, when the page needs any |
| `<benchmark>/index.html` | generated; committed so a clone opens without a build |
| `<benchmark>/README.md` | what it covers, its conventions, its known gaps |
| `tools/build.py` | composes the shell + shared + product parts into each `index.html` |
| `tools/update_fx.py` | refreshes the EUR/USD and EUR/CHF rates across every dataset |
| `AGENTS.md` | maintenance guide: data models, collection procedure, publishing |

```bash
python3 tools/build.py                 # rebuild every benchmark
python3 tools/build.py block-storage   # or just one
```

Adding a benchmark means adding a folder with those four required parts — `build.py` finds it
by that signature, so there is no registry to update. `AGENTS.md` has the procedure.

## Refreshing the data

`AGENTS.md` documents the full procedure. In short:

```bash
python3 tools/update_fx.py                                               # latest ECB rates, every dataset
python3 tools/update_fx.py --usd 1.1652 --chf 0.9404 --date 2026-09-09   # or set them by hand
python3 tools/build.py
```

Prices must be re-read from the vendors' own pricing pages with the region explicitly
selected. Most vendors render prices client-side, so a plain HTTP fetch returns empty
placeholders — `AGENTS.md` lists the price feeds those pages consume, including the AWS Price
List Bulk API, the Azure Retail Prices API, the OVHcloud order catalogue and Exoscale's own
pricing API. Anything that cannot be confirmed at the source is recorded as *not published*,
never estimated.

## Caveats

Maintained by someone who works at Exoscale, and Exoscale's rows are highlighted in the
tables. The figures are taken from competitors' own published pages and every source is listed
at the bottom of each page — but treat this as a starting point for your own verification, not
as an authority. List prices ignore negotiated discounts and commitment terms, which are where
large deals are actually decided.

## Licence

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0) — see `LICENSE`. Reuse, adapt and redistribute the datasets and the pages,
including commercially, as long as you give credit:

> EU Cloud Computing Price Benchmarks, Antoine Coetsier — https://github.com/retrack/eu-cloud-computing-price-benchmarks — CC BY 4.0

If you adapt the figures or change the normalisation basis, say so, so a reader does not
attribute your numbers to this reading.

The licence covers this repository's own content. It does not cover the vendors' published
prices themselves, which are facts, nor any vendor trademark named in the tables.
