import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function createStore(dataDir, firestore = null) {
  mkdirSync(dataDir, { recursive: true })
  const file = join(dataDir, 'projects.json')
  const deliveriesFile = join(dataDir, 'github-deliveries.json')
  const read = () => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  const write = (rows) => writeFileSync(file, JSON.stringify(rows, null, 2))
  const readDeliveries = () => existsSync(deliveriesFile) ? JSON.parse(readFileSync(deliveriesFile, 'utf8')) : {}
  return {
    async all() {
      if (!firestore) return read()
      const snap = await firestore.collection('omgithub_projects').orderBy('published_at', 'desc').limit(200).get()
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    },
    async bySlug(slug) {
      if (!firestore) return read().find(row => row.slug === slug) || null
      const snap = await firestore.collection('omgithub_projects').where('slug', '==', slug).limit(1).get()
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
    },
    async bySourceKey(sourceKey) {
      if (!firestore) return read().find(row => row.source_key === sourceKey) || null
      const snap = await firestore.collection('omgithub_projects').where('source_key', '==', sourceKey).limit(1).get()
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
    },
    async put(project) {
      if (firestore) await firestore.collection('omgithub_projects').doc(project.id).set(project, { merge: true })
      const rows = read(), index = rows.findIndex(row => row.id === project.id)
      if (index >= 0) rows[index] = { ...rows[index], ...project }; else rows.unshift(project)
      write(rows); return project
    },
    async claimDelivery(deliveryId, metadata = {}) {
      const claimedAt = Date.now()
      if (firestore) {
        const ref = firestore.collection('omgithub_github_deliveries').doc(deliveryId)
        return firestore.runTransaction(async transaction => {
          const existing = await transaction.get(ref)
          if (existing.exists) return false
          transaction.create(ref, { ...metadata, claimed_at: claimedAt })
          return true
        })
      }
      const deliveries = readDeliveries()
      const cutoff = claimedAt - 7 * 24 * 60 * 60 * 1000
      for (const [id, value] of Object.entries(deliveries)) {
        if (Number(value.claimed_at || 0) < cutoff) delete deliveries[id]
      }
      if (deliveries[deliveryId]) return false
      deliveries[deliveryId] = { ...metadata, claimed_at: claimedAt }
      writeFileSync(deliveriesFile, JSON.stringify(deliveries, null, 2))
      return true
    },
    async releaseDelivery(deliveryId) {
      if (firestore) {
        await firestore.collection('omgithub_github_deliveries').doc(deliveryId).delete()
        return
      }
      const deliveries = readDeliveries()
      if (!deliveries[deliveryId]) return
      delete deliveries[deliveryId]
      writeFileSync(deliveriesFile, JSON.stringify(deliveries, null, 2))
    }
  }
}
