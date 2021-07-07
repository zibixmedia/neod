# neod 
neo4j connection/session/result wrapper

### ABOUT
Neod creates a connections & session library and allows query and transactions with simple function calls. Neod also returns clean results in managable javascript objects.
Visit our Homepage Community at: https://neo4j-enthusiasts.openhours.app/home

### Installation
Install using NPM package manager.

https://www.npmjs.com/package/@zibix/neod

### Require neod
```javascript
const neod = require('@zibix/neod')
```

### Create a connection
```javascript
neod.connection_open({
    alias: 'myconnection', // required 
    uri: 'neo4j://neo4jdatabase.com', // required
    database: 'mydatabase', // required
    user: 'neo4j', // required
    password: 'password', // required
    scrub_results: true, // optional boolean (defaults to true)
    retry_deadlock: true // optional boolean (defaults to true)
})
```

### Open a Session
sessions can be read or write sessions. There are performance gains in creating read sessions. But write sessions can be used for both read & write
```javascript
// READ SESSION
let session_read = neod.read_session_open('myconnection')

// WRITE SESSION
let session_write = neod.write_session_open('myconnection')
```

### Querying your Database
```javascript
// READ QUERY
let read_results = await neod.query(session_read,{
    cypher: 'MATCH (n:NodeLabel) RETURN n limit 10', // required
    params: {} // optional
})

let write_results = await neod.transaction(session_write, {
    cypher: 'MERGE (n:NodeLable) SET n.parameter = $value', // required
    params: { // optional
        value: 'test node'
    }
})
```

### Closing Individual Sessions
You can close individual sessions.
```javascript
neod.session_close(session_read)
```

### Closing Individual Connections
You can close individual connections. This will also close all sessions associated with that connection.
```javascript
neod.connection_close('myconnection')
```

### Close all Connections and Sessions
You can close all connections and associated sessions by calling the connection closer with no specified connection alias.
```javascript
neod.connection_close()
```