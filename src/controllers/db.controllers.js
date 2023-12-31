import path from 'path'
import fs from 'fs'
import { createConnection } from 'mysql2/promise';
import {db} from '../db/connection.js'
import { DB_DATABASE,__dirname } from '../config.js';

export const createModel = async (req, res) => {
    const script = fs.readFileSync(path.join(__dirname, '../db/database.sql'), 'utf8')
    const queries = script.split(';').map(query => query.trim())
    const conn = await createConnection(db)
    for (let i = 0; i < queries.length; i++) {
        if (queries[i].length === 0 ) continue
        await conn.query(queries[i])
    }
    await conn.end()
    res.send('Creacion de bases de datos finalizada')
}

export const deleteModel = async (req, res) => {
    const conn = await createConnection(db)
    await conn.query(`DROP DATABASE ${DB_DATABASE}`)
    await conn.end()
    res.send('Base de datos eliminada')
}

const getQueries = (table, params) => {
    let fieldOrder = ""
    let marks = ""
    for (const field of params) {
        fieldOrder += field + ','
        marks += '?,'
    }
    fieldOrder = fieldOrder.slice(0, -1)
    marks = marks.slice(0, -1)
    const temp = `INSERT INTO ${DB_DATABASE}.temp_${table} (${fieldOrder}) VALUES (${marks})`
    const final = `INSERT INTO ${DB_DATABASE}.${table} (${fieldOrder}) SELECT ${fieldOrder} FROM ${DB_DATABASE}.temp_${table}`
    return {temp: temp, final: final}
}

export const loadData = async (req, res) => {
    //crear todas las tablas temporales
    const script = fs.readFileSync(path.join(__dirname, '../db/temporary.sql'), 'utf8')
    const queries = script.split(';').map(query => query.trim())
    var conn = await createConnection(db)
    for (let i = 0; i < queries.length; i++) {
        if (queries[i].length === 0 ) continue
        await conn.query(queries[i])
    }
    console.log('Tablas temporales creadas')
    let csv, rows, query

    //Cargar datos de tabla 'cargo'
    csv = path.join(__dirname, `../../TSEdatasets/cargos.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('cargo',['id_cargo','cargo'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        await conn.query(query.temp,fields)
    }
    await conn.query(query.final)
    console.log('Tabla cargo')

    //Cargar datos de tabla 'departamento'
    csv = path.join(__dirname, `../../TSEdatasets/departamentos.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('departamento',['id_dep','nombre'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        await conn.query(query.temp,fields)
    }
    await conn.query(query.final)
    console.log('Tabla departamento')

    //Cargar datos de tabla 'ciudadano'
    csv = path.join(__dirname, `../../TSEdatasets/ciudadanos.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('ciudadano',['dpi','nombre','apellido','direccion','telefono','edad','genero'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        await conn.query(query.temp,fields.slice(0,7))
    }
    await conn.query(query.final)
    console.log('Tabla ciudadano')

    //Cargar datos de tabla 'partido'
    csv = path.join(__dirname, `../../TSEdatasets/partidos.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('partido',['id_partido','nombre','siglas','fundacion'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].trim().match(/(?=.+,?)([-0-9A-zÀ-ú/ ]+|"[^"]+"|)/g)
        //const fields = rows[i].split(',').map(value => value.trim())
        const date = fields[6].split('/')
        fields[6]= `${date[2]}-${date[1]}-${(date[0].length === 1) ? '0'+date[0]:date[0]}`
        await conn.query(query.temp,[fields[0],fields[2].replaceAll('"',''),fields[4],fields[6]])
    }
    await conn.query(query.final)
    console.log('Tabla partido')

    //Cargar datos de tabla 'candidato'
    csv = path.join(__dirname, `../../TSEdatasets/candidatos.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('candidato',['id_candidato','nombre','nacimiento','id_partido','id_cargo'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        const date = fields[2].split('/')
        fields[2]= `${date[2]}-${date[1]}-${(date[0].length === 1) ? '0'+date[0]:date[0]}`
        await conn.query(query.temp,fields)
    }
    await conn.query(query.final)
    console.log('Tabla candidato')

    //Cargar datos de tabla 'mesa'
    csv = path.join(__dirname, `../../TSEdatasets/mesas.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('mesa',['id_mesa','id_dep'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        await conn.query(query.temp,fields)
    }
    await conn.query(query.final)
    console.log('Tabla mesa')

    //Cargar datos de tabla 'voto' y 'detalle_voto'
    csv = path.join(__dirname, `../../TSEdatasets/votaciones.csv`)
    rows = fs.readFileSync(csv, 'utf8').split('\n')
    query = getQueries('voto',['id_voto','id_candidato','dpi','id_mesa','fecha_hora'])
    for (let i = 1; i<rows.length; i++) {
        if (rows[i].length === 0) continue
        const fields = rows[i].split(',').map(value => value.trim())
        const date_time = fields[4].split('/')
        const year_time = date_time[2].split(' ')
        const dateStr = `${year_time[0]}-${date_time[1]}-${(date_time[0].length === 1) ? '0'+date_time[0]:date_time[0]}`
        const time = year_time[1].split(':')
        const timeStr = `${(time[0].length === 1) ? '0'+time[0]:time[0]}:${time[1]}:00`
        fields[4]= dateStr+' '+timeStr
        await conn.query(query.temp, fields)   
    }
    const voteQuery = `
        INSERT INTO ${DB_DATABASE}.voto (id_voto, dpi, id_mesa, fecha_hora)
        SELECT DISTINCT temp.id_voto, temp.dpi, temp.id_mesa, temp.fecha_hora
        FROM ${DB_DATABASE}.temp_voto temp
        LEFT JOIN ${DB_DATABASE}.voto v ON temp.id_voto = v.id_voto
        WHERE v.id_voto IS NULL
    `
    await conn.query(voteQuery)
    console.log('Tabla voto')
    const detailQuery = `
        INSERT INTO ${DB_DATABASE}.detalle_voto (id_voto, id_candidato)
        SELECT id_voto, id_candidato FROM ${DB_DATABASE}.temp_voto
    `
    await conn.query(detailQuery)
    console.log('Tabla detalle_voto')

    await conn.end()
    res.send("Datos cargados en el modelo")
}
