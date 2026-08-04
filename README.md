# @pipeworx/discogs

Discogs MCP — music release / artist / label database.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search(query, type?, title?, artist?, label?, format?, country?, year?, genre?, style?, page?, per_page?)`
- `get_release(release_id)`
- `get_master(master_id)`
- `get_artist(artist_id)`
- `get_label(label_id)`

## Auth

BYO personal access token. Pass `?_apiKey=<token>` after generating one at https://www.discogs.com/settings/developers (free).

## Data source

`https://api.discogs.com` — header `Authorization: Discogs token=<token>`.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "discogs": {
      "url": "https://gateway.pipeworx.io/discogs/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Discogs data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
