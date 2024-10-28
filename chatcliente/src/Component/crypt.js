import { MD5 } from 'crypto-js'
const Blowfish = require('blowfish-node');

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg)
  }
}

function det(matrix) {
  let negated = false;
  const rowIndices = [0, 1, 2, 3];

  for (let k = 0; k < 4; k++) {
    let k_ = rowIndices[k];

    if (matrix[k_][k] === 0) {
      let found = false;
      for (let _k = k + 1; _k < 4; _k++) {
        if (matrix[rowIndices[_k]][k] !== 0) {
          [rowIndices[k], rowIndices[_k]] = [rowIndices[_k], rowIndices[k]];
          negated = !negated;
          k_ = rowIndices[k];
          found = true;
          break;
        }
      }
      if (!found) return matrix[k_][k];
    }

    const piv = matrix[k_][k];
    const piv_ = k === 0 ? 1 : matrix[rowIndices[k - 1]][k - 1];

    for (let i = k + 1; i < 4; i++) {
      const i_ = rowIndices[i];
      for (let j = k + 1; j < 4; j++) {
        matrix[i_][j] = (matrix[i_][j] * piv - matrix[i_][k] * matrix[k_][j]) / piv_;
      }
    }
  }

  const det = matrix[rowIndices[3]][3];
  return negated ? -det : det;
}

function chave(nome) {
  let md5 = MD5(nome).toString()
  md5 = md5.match(/.{2}/g)
  assert(md5.length === 16, md5)
  md5.forEach((ele) => {assert(ele.length === 2, "2"); ele = parseInt(ele, 16)})
  let matriz = []
  for (let i=0; i < md5.length; i += 4) {
    matriz.push(md5.slice(i, i+4))
  }
  return det(matriz)
}

function enc(nome, texto) {
  let c = chave(nome)
  //texto = texto.padEnd((Math.floor((texto.length / 8)) * 8 ) + 8)
  const bf = new Blowfish(c.toString(), Blowfish.MODE.ECB, Blowfish.PADDING.SPACES);
  return bf.encode(texto)
}

function dec(nome, texto) {
  let c = chave(nome)
  //texto = texto.padEnd((Math.floor((texto.length / 8)) * 8 ) + 8)
  const bf = new Blowfish(c.toString(), Blowfish.MODE.ECB, Blowfish.PADDING.SPACES);
  texto = new Uint8Array(JSON.parse(`[${texto}]`))
  return bf.decode(texto)
}

export { enc, dec }
