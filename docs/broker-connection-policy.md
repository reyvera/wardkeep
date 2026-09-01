# Broker Connection Policy

Wardkeep may connect to a brokerage only through a broker's documented, sanctioned integration. Connections are read-only: they may import account identity, positions, cost basis, balances, and supported quote references. Wardkeep never submits orders, transfers funds, changes beneficiaries, or holds brokerage credentials in browser storage.

## First supported paths

- **Alpaca:** a user-authorized, read-only positions connection. Market prices remain a separately disclosed market-data feed.
- **Robinhood Crypto:** only the official crypto API's read-only account and holdings capabilities. General Robinhood securities-account syncing is not supported unless Robinhood grants written authorization for the integration.

## Connection requirements

1. The user completes the broker's authorization flow or supplies a narrowly scoped broker credential through a protected server-side flow.
2. Wardkeep encrypts the resulting secret at rest, records the provider and authorized scope, and shows the last successful synchronization time.
3. The user can disconnect at any time. Disconnecting removes the encrypted credential and prevents future synchronizations; it does not erase records already imported into Wardkeep unless the user separately deletes them.
4. Every broker sync is informational. A quoted price, holding value, gain/loss calculation, or asset allocation is not investment advice, a recommendation, or a trading signal.

## Market-data disclosure

Wardkeep shows the price source, feed, quote timestamp, currency, and known delay. It must not label a quote "live" when the provider's plan or the market session makes it delayed, indicative, or stale.
