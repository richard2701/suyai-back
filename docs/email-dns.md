# Email DNS records (issue #72)

Zone `transfersuyai.cl` in Cloudflare. Mail is sent by Resend (Amazon SES underneath) with
`From: noreply@transfersuyai.cl` (`SMTP_FROM`). Read through the Cloudflare API on 2026-11-18.

| Name | Type | Value | Purpose |
|------|------|-------|---------|
| `resend._domainkey` | TXT | `p=MIGfMA0...` (Resend public key) | DKIM, `d=transfersuyai.cl`: aligned with the From domain |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | SPF for the bounce (Return-Path) domain `send.transfersuyai.cl`: relaxed-aligned with the From domain |
| `send` | MX | `feedback-smtp.us-east-1.amazonses.com` | SES bounce/feedback |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:<owner gmail>; fo=1` | DMARC, monitor mode since 2026-11-03 |

The apex has no SPF record and no MX; it does not send mail, and DMARC covers spoofing of it.

## Reporting gap (blocks moving to quarantine)

`rua` points to a `gmail.com` mailbox. Per RFC 7489 section 7.1 a report destination on another
domain must authorize it with `transfersuyai.cl._report._dmarc.gmail.com`, which does not exist
(NXDOMAIN), so compliant reporters may drop the reports. Cloudflare DMARC Management for the
zone reports status `missing-dmarc-rua` (not enabled). Result: no aggregate report evidence.

Fix: enable Cloudflare DMARC Management (dashboard > Email > DMARC Management). It appends a
Cloudflare `rua` address to the existing record and shows sources and pass rates. Then review
2 to 4 weeks of reports before changing `p`.

## Policy roadmap

1. Now: `v=DMARC1; p=none; rua=mailto:<owner gmail>; fo=1` (rollback value).
2. After clean reports (all sources Resend/SES, DMARC pass): `v=DMARC1; p=quarantine; pct=100; rua=<same>; fo=1`.
3. About a month later with clean reports: `p=reject`.
