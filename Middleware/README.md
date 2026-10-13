# Middleware

Examples of a customer building a layer between FrankieOne and its own clients. The pattern comes up whenever one organisation onboards people on behalf of many others, such as a platform, a clearing house, an aggregator or a tranche 2 business serving its own client base, through a single FrankieOne account.

In every example:

- The customer's layer holds the only FrankieOne API key. Its clients never call FrankieOne and never get Portal access.
- Each client of the customer gets its own scoped view, and can never see another client's data, or that another client exists.
- The customer's own compliance team still sees everything, in one place.

| Example | Pattern | Port |
|---|---|---|
| [Onboarding as a Service](Onboarding%20as%20a%20Service/) | A clearing platform onboards investors for 300 intermediaries on one account. One record per investor, a scoped console per intermediary, and checks reused across intermediaries. | 8101 |

More examples, such as a tranche 2 one, can sit alongside it as their own folders.
