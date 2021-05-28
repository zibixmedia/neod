/**
 * Creates a Neo4j Connection Library and Session Manager
 * Processes queries and transactions
 * Scrubs results into clean response objects
 * parses bitints into strings for javascript
 * 
 * https://github.com/zibixmedia/neod
 *
 * Copyright (c) 2020 Eric Wiltshire
 * MIT License - http://opensource.org/licenses/mit-license.php
 *
 */

 const neo4jdriver = require('neo4j-driver')
 const graphtypes = require('neo4j-driver/lib/graph-types.js')
 const temporaltypes = require('neo4j-driver/lib/temporal-types.js')
 
 class neod {
 
     constructor () {
         this.connections = {}
         this.sessions = {}
     }
 
     connection_open = (params) => {
 
         // add/update a connection in the connection_library
         try {
 
             // validate input
             let connection_params = {
                 alias: null,
                 uri: null,
                 database: null,
                 user: null,
                 password: null
             }
             let connection_result = { error: false, error_text:[] }
             Object.keys(connection_params).forEach((key) => {
                 if(params[key] && typeof params[key] == 'string'){
                     connection_params[key] = params[key]
                 } else {
                     connection_result.error_text.push('invalid param: ' + key)
                     connection_result.error = true
                 }
             })
 
             // optional params
             if(!params.retry_deadlock || params.retry_deadlock !== false){
                 params.retry_deadlock = true
             }
             if(!params.scrub_results || params.scrub_results !== false){
                 params.scrub_results = true
             }
 
             if(connection_result.error){
                 return connection_result
             }else{
                 try {
                     this.connections[connection_params.alias] = {
                         database: connection_params.database,
                         session_counter: 0,
                         scrub_results: params.scrub_results,
                         retry_deadlock: params.retry_deadlock,
                         driver: neo4jdriver.driver(
                             connection_params.uri,
                             neo4jdriver.auth.basic(
                                 connection_params.user,
                                 connection_params.password
                             )
                         )
                     }
                 } catch (error){
                     connection_result.error = true
                     connection_result.error_text.push(error.code)
                 }
                 return connection_result
             }
 
         } catch (error) {
             console.log('neoderror:', error)
         }
 
     }
 
     read_session_open = (connection) => {
 
         try {
 
             let session = {
                 connection: connection,
                 type: 'read',
                 session_id: this.connections[connection].session_counter++,
                 session: this.connections[connection].driver.session({
                     database: this.connections[connection].database,
                     defaultAccessMode: 'READ'
                 })
             }
 
             if(!this.sessions[connection]){
                 this.sessions[connection] = {}
             }
 
             this.sessions[connection][session.session_id] = session
 
             return this.sessions[connection][session.session_id]
 
         } catch (error) {
             console.log('neoderror:', error)
         }
 
     }
 
     write_session_open = (connection) => {
 
         try {
 
             let session = {
                 connection: connection,
                 type: 'write',
                 session_id: this.connections[connection].session_counter++,
                 session: this.connections[connection].driver.session({
                     database: this.connections[connection].database,
                     defaultAccessMode: 'WRITE'
                 })
             }
 
             if(!this.sessions[connection]){
                 this.sessions[connection] = {}
             }
 
             this.sessions[connection][session.session_id] = session
 
             return this.sessions[connection][session.session_id]
 
         } catch (error) {
             console.log('neoderror:', error)
         }
 
     }
 
     session_close = async (session) => {
 
         if(this.sessions[session.connection] && this.sessions[session.connection][session.session_id]){
             await this.sessions[session.connection][session.session_id].session.close()
             delete this.sessions[session.connection][session.session_id]
         }
 
         return true
 
     }
 
     connection_close = async (connections = false) => {
 
         if(!connections){
             connections = Object.keys(this.connections)
         } else {
             connections = [connections]
         }
         
         connections.forEach((connection) => {
 
             if(this.sessions[connection]){
                 Object.keys(this.sessions[connection]).forEach((session_id) => {
                     this.session_close(this.sessions[connection][session_id].session)
                 })
             }
             delete this.sessions[connection]
             this.connections[connection].driver.close()
             delete this.connections[connection]
             
         })
 
         return true
 
     }
 
     query = async (session,params) => {
 
         try {
 
             if(!params.params){
                 params.params = {}
             }
 
             let results = await session.session.run(
                 params.cypher,
                 params.params
             )
             if(this.connections[session.connection].scrub_results){
                 return this.scrubResults(results)
             }else{
                 return results
             }
 
         } catch (error) {
             console.log('neoderror:', error)
         }
 
     }
 
     transaction = async (session,params) => {
 
         try {
 
             if(!params.params){
                 params.params = {}
             }
 
             let transaction = session.session.beginTransaction()
 
             let results = await this.transaction_process(transaction,params)
 
             if(!results.success){
                 if(results.error_code == 'Neo.TransientError.Transaction.DeadlockDetected' &&
                     this.connections[session.connection].retry_deadlock){
                         // retry deadlocks
                         let results = await this.transaction_process(transaction,params)
                     }
             }
 
             if(results.success && results.results && this.connections[session.connection].scrub_results){
                 results.results = this.scrubResults(results.results)
             }
 
             return results.results
 
         } catch (error){
             console.log('neoderror:', error)
         }
 
     }
 
     transaction_process = async (transaction,params) => {
 
         try {
 
             let results = await transaction.run(
                 params.cypher,
                 params.params
             )
             
             await transaction.commit()
             
             return {
                 success: true,
                 results: results,
                 error_code: null
             }
 
         } catch (error) {
             console.log('neoderror:', error)
             await tx.rollback()
             return {
                 success: false,
                 results: null,
                 error_code: error.code
             }
         }
     }
 
 
     scrubResults(result) {
 
         if (!result || !result.records || result.records.length == 0) {
           return null
         }
     
         let results = []
         result.records.forEach((record) => {
           let result_row = {}
           record.keys.forEach(key => {
             let row = record.get(key)
             result_row[key] = row
           })
           results.push(result_row)
         })
 
         results = this.scrubRabbitHole(results)
         return results
     }
     
     
     scrubRabbitHole(results) {
         
         if(temporaltypes.isDateTime(results) || temporaltypes.isDate(results) || temporaltypes.isLocalTime(results) || temporaltypes.isLocalDateTime(results) || temporaltypes.isTime(results)){
            
             let temporal = {}
             Object.keys(results).forEach((key) => {
                 temporal[key] = this.scrubRabbitHole(results[key])
             })
             
            if(temporaltypes.isDateTime(results) || temporaltypes.isDate(results) || temporaltypes.isLocalDateTime(results)){
                temporal['unixTZO'] = Date.UTC(
                    temporal['year'], // year
                    temporal['month'] - 1, // month
                    temporal['day'], // day
                    temporal['hour']??0, // hour
                    temporal['minute']??0, // minute
                    temporal['second']??0, // second
                    temporal['nanosecond']??0 / 1000000
                )
                temporal['unixUTC'] = temporal['unixTZO'] - ((temporal['timeZoneOffsetSeconds']??0) * 1000)
            }
            
            return temporal
         }
 
         // IS IT A NODE
         if (graphtypes.isNode(results) || graphtypes.isRelationship(results)) {
           return this.scrubRabbitHole(results.properties)
         }
     
         // IS IT AN INTEGER
         if (neo4jdriver.isInt(results)) {
           if (neo4jdriver.integer.inSafeRange(results)) {
             return results.toNumber()
           } else {
             return results.toString()
           }
         }
     
         // IS IT AN ARRAY
         if (Array.isArray(results)) {
           var array_results = []
           results.forEach((record) => {
             array_results.push(
               this.scrubRabbitHole(record)
             )
           })
           return array_results
         }
     
         // IS IT A KEY/VALUE OBJECT
         if (typeof results === 'object' && results !== null) {
           Object.keys(results).forEach((key) => {
             results[key] = this.scrubRabbitHole(results[key])
           })
           return results
         }
     
         // IS IT BORING?
         return results
     
     }
     
     scrubIntegers(params) {
     
         Object.keys(params).forEach((key) => {
           if (neo4jdriver.isInt(params[key])) {
             if (neo4jdriver.integer.inSafeRange(params[key])) {
               params[key] = params[key].toNumber()
             } else {
               params[key] = params[key].toString()
             }
           }
         })
         return params
     
     }
     
 }
 
 module.exports = new neod
 
 