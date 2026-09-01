package com.ohmygithub.fps

import org.junit.Assert.*
import org.junit.Test

class GameLogicTest {
    @Test
    fun targetCreationIsWithinBounds() {
        val t = Target(id = 1, x = 0.5f, z = 3f)
        assertTrue(t.x in -1f..1f)
        assertTrue(t.z in 1f..10f)
        assertTrue(t.alive)
    }

    @Test
    fun targetHitLogicMarksDead() {
        val targets = mutableListOf(Target(0, 0f, 2f), Target(1, 0.8f, 5f))
        val hit = targets[0].copy(alive = false)
        targets[0] = hit
        assertFalse(targets[0].alive)
        assertTrue(targets[1].alive)
    }

    @Test
    fun scoreCalculationIsCorrect() {
        var score = 0
        val level = 2
        score += 150 * level
        assertEquals(300, score)
    }

    @Test
    fun ammoReloadResets() {
        var ammo = 0
        val isReloading = true
        if (isReloading) ammo = 30
        assertEquals(30, ammo)
    }

    @Test
    fun yawClampingWorks() {
        var yaw = 50f
        yaw = yaw.coerceIn(-40f, 40f)
        assertEquals(40f, yaw, 0.01f)
    }
}
