# Managed PostgreSQL — Europe

Managed PostgreSQL from eleven providers, priced for **a workload you define** at the cheapest size each offer
sells for it, in **euros per month on a 730-hour basis**, Frankfurt region or the closest each vendor operates.
17 offers, including Aiven's own prices on six clouds.

Open [`index.html`](index.html). Prices observed **21 September 2026**. Prices in USD and CHF are converted at the rate every
page of this repository carries: ECB 09.09.2026: 1 EUR = 1.1652 USD = 0.9404 CHF.

## What the page does

Vendors sell sizes, not gigabytes: a plan, an instance class, a node shape. So the page does not rank a unit price.
It takes a workload and, for every offer, keeps the sizes that meet it and prices the cheapest one: compute for all
the nodes, storage the way that vendor bills it, and any backup data you enter.

| Control | Default | Effect |
|---|---|---|
| vCPU per node | 2 | minimum vCPU of the size |
| RAM per node | 8 GiB | minimum RAM, compared as each vendor states it |
| RAM rule | strict | or accept sizes up to 10 % below the RAM asked (several vendors sell a "16" size with 15 GB) |
| Storage | 100 GiB | priced as bundled, extra, per node or per GB-hour, as the vendor bills it |
| High availability | none | 1 or 2 standby nodes |
| Point-in-time recovery | not required | at least 1, 2, 7, 14 or 30 days |
| Backup data billed | 0 GiB | how much backup a database generates is not published by anyone |
| Hours per month | 730 | 720, 730 or 744 |
| Scenarios | none | four presets, from a small single node to two standbys with 30 days of recovery |
| Include | both off | burstable or shared vCPU sizes; plans that need activation for the account |

Three behaviours are specific to this page:

- **One size per offer.** The table shows which size was picked and why it is the cheapest that fits.
- **A bar is hatched** when the cheapest size still fails a requirement: no point-in-time recovery, a shorter
  window than asked, or a disk cap below the storage requested. It is priced at the most the vendor offers.
- **A price marked ≥ is a lower bound**: a cost the vendor does not publish is missing from it.

## Conventions specific to this benchmark

- Storage is bundled or separate. A plan whose disk cannot be extended is priced at the next plan up when the
  workload needs more disk; vendors that bill storage apart add it at their published rate.
- High availability is billed three ways: the instance and its storage twice (AWS Multi-AZ, Azure), per node
  (OVHcloud), or as a separate plan (Exoscale, Aiven). Each is priced the way the vendor bills it.
- Point-in-time recovery is compared as each vendor states it; a window set by plan tier is not a window you choose.
- Burstable and shared vCPU sizes are off by default: their price is real, their performance is not comparable to a
  dedicated core.

## Known gaps and contradictions

| Provider | Status |
|---|---|
| All | Storage is SSD-class only: AWS magnetic, Google HDD and IONOS or UpCloud HDD tiers are left out, although Google HDD is cheaper (in the small scenario 132 $ against 142 $). |
| Exoscale | Plans the API marks authorized=false (all cpu-*, so-* and the largest standard sizes) need activation for the account; they are hidden until switched on. Exoscale's SLA page gives PITR windows of 1, 2, 14 and 30 days; its product page and API count 2, 3, 15 and 31 daily backups, which is the same thing. |
| AWS | Only classes AWS flags as current generation are used. Reserved instances and Savings Plans are not priced. Storage is gp3 at the deployment option's published rate; provisioned IOPS above the included baseline are not costed. The price list gives gp3 as 5 GB to 16 TB, the RDS User Guide and pricing page say 20 GiB to 64 TiB: the User Guide is used. Backup retention defaults to 1 day by API or CLI and 7 days in the console. |
| Azure | The cheapest documented series is the older Dsv3/Esv3 at 4 to 6 % under the v5 price; the feed also carries Dsv6, Dasv6, Esv6 and Easv6, which Microsoft's compute page does not list, so they are left out. Storage is Premium SSD v2 in 1 GiB steps, 32 GiB minimum (Microsoft's pages say 32 GiB in one place and 1 GiB in another); Premium SSD v1 sells fixed disk sizes. The regions table (updated 2026-01-09) flags new zone-redundant HA as restricted in Germany West Central and nothing current confirms it either way; same-zone HA exists at 99.95 %. Both bill compute and storage twice. |
| Google Cloud | Enterprise custom sizes on SSD and N4 with Hyperdisk Balanced at the documented minimum IOPS and throughput (3,000 and 140 MiB/s; the default settings add about 27 $ on a 100 GiB disk; not tested); Enterprise Plus N2 and C4A fixed sizes. C4 is priced on the pricing page but missing from the region availability page for Frankfurt, so it is left out. Cloud Storage cost of PITR logs and any backup free allowance are not published. Google's docs disagree on the shared-core disk ceiling and on the backup retention range. GB is read as GiB (3.75 GB = 3,840 MB in the docs). Committed-use discounts and the Enterprise Plus data cache are not priced. |
| OVHcloud | Discovery B3-4: the German price page shows the APAC pricing zone's figure, not the default zone's; the order catalogue is kept and the row is flagged. OVHcloud states backup retention by plan and 'point in time recovery: included' but no separate PITR window; the window shown is the retention. Its docs contradict each other on multi-AZ, backup billing and storage shrink. |
| Scaleway | No Frankfurt region: Paris is used. Whether the HA standby's own volume is billed is not published, so HA rows are lower bounds. Scaleway documents no point-in-time recovery, only daily backups or snapshots. Its docs give two storage ceilings, 10 TB and 15 TB. The Cost Optimized range states no CPU sharing model. |
| STACKIT | EU01 is Germany South, there is no Frankfurt region. No flavor has 2 vCPU with 8 GB, so the small scenario buys 4 vCPU. The cheapest performance class (1,000 IOPS, 100 MB/s) is added per node and cannot be changed later; a Replica set is three nodes and pays capacity and class three times. No CPU type or maximum retention is published for PostgreSQL. The price list PDF (v1.0.43, 2026-08-04) is older than the price feed used. |
| IONOS | Left out of this reading: IONOS does not state whether one of its cores is one vCPU, nor that every node of a cluster is billed, and the price of the workload depends on both. |
| UpCloud | UpCloud's own pages carry two price lists, both shown: the product page's bundled plans (single-node plans stop at 4 GB, 13 plans in the docs have no price) and the pricing page's tiers, where included storage and hourly prices are not printed, so those rows are lower bounds. No independent second source for either. CPU type and VAT status are not published. Backup days differ across three pages. |
| DigitalOcean | The monthly price is used (hourly is capped at 672 hours). Every GiB of disk is billed at the storage rate, in 10 GiB steps, including the minimum. The HA price is not published for Standard Premium Intel General Purpose and Storage Optimized plans; those sizes are offered without HA here rather than guessed. The docs quote $15.00, $30.00 and $130.00 as starting prices where the pricing page shows $15.15, $30.45 and $135.75 (minimum disk included); the pricing page is used. |
| Linode (Akamai) | No plan is exactly 2 vCPU with 8 GB or 4 vCPU with 16 GB. Included disk is taken from the API, which is 6 to 64 % below the price page's storage column; extra disk cannot be bought. The page lists a G7 512 GB plan the API does not return, and one G7 id says 24 vCPU where the page says 32. The docs say one or two nodes on shared plans, the table and API say 1 or 3. Backup retention is 14 days on two pages and the last week on a third. The published monthly price is used. |
| Aiven direct | Free and Developer plans are left out: no choice of cloud or region. Aiven's pricing page says Hobbyist has a single backup for disaster recovery and no PITR, and its backup docs say 'None', but its high-availability docs list 2 days; Hobbyist is shown without PITR. Prices differ by region within a cloud (checked live: UpCloud Sydney is dearer than Frankfurt), so the Frankfurt region id is used for every cloud. |

Providers with no PostgreSQL price to compare:

| Provider | Status |
|---|---|
| Infomaniak | none published for PostgreSQL |
| cloudscale.ch | none published by cloudscale; partner prices are on partner sites and out of scope here |
| Hetzner Cloud | none (no product) |

## Rebuilding

```bash
python3 ../tools/build.py managed-postgresql
```

`data.js`, `page.html`, `page.js` and `style.css` are the sources, composed with `shared/` into `index.html`.
