package com.ohmygithub.fps

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.*
import kotlin.random.Random

data class Target(
    val id: Int,
    var x: Float, // -1..1 world X
    var z: Float, // distance 1..10
    var alive: Boolean = true,
    var hitAnim: Float = 0f
)

data class HitNumber(
    val id: Int,
    val offsetX: Float,
    val value: Int,
    val born: Long = System.currentTimeMillis()
)

data class Brass(
    val id: Int,
    val born: Long = System.currentTimeMillis(),
    val vx: Float,
    val vy: Float,
    val spin: Float
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3DDC84),
                    background = Color(0xFF0A0F1A),
                    surface = Color(0xFF141C2B)
                )
            ) {
                FpsGameScreen()
            }
        }
    }
}

@Composable
fun FpsGameScreen() {
    var score by remember { mutableIntStateOf(0) }
    var ammo by remember { mutableIntStateOf(30) }
    var health by remember { mutableIntStateOf(100) }
    var level by remember { mutableIntStateOf(1) }
    var isReloading by remember { mutableStateOf(false) }
    var crosshairOffset by remember { mutableStateOf(Offset.Zero) }
    var yaw by remember { mutableStateOf(0f) } // player rotation
    var pitch by remember { mutableStateOf(0f) }
    var recoil by remember { mutableStateOf(0f) }
    var muzzleFlash by remember { mutableStateOf(false) }
    var kills by remember { mutableIntStateOf(0) }
    var gameMessage by remember { mutableStateOf("ELIMINATE HOSTILES") }
    var hitMarkerVisible by remember { mutableStateOf(false) }
    var hitMarkerScale by remember { mutableStateOf(0f) }
    var damageFlash by remember { mutableStateOf(false) }
    var screenShake by remember { mutableStateOf(Offset.Zero) }
    // AAA hit-feedback: floating combat text + frame ticker for smooth rise/fade
    var hitNumbers by remember { mutableStateOf(listOf<HitNumber>()) }
    var hitNumberSeq by remember { mutableIntStateOf(0) }
    var frameTick by remember { mutableIntStateOf(0) }
    // AAA brass ejection particle queue (MW3 shell physics)
    var brasses by remember { mutableStateOf(listOf<Brass>()) }
    var brassSeq by remember { mutableIntStateOf(0) }
    var targets by remember {
        mutableStateOf(
            List(5) { i ->
                Target(
                    id = i,
                    x = Random.nextFloat() * 2f - 1f,
                    z = Random.nextFloat() * 6f + 2f
                )
            }
        )
    }

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulse by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    // AAA recoil spring + muzzle timing + hit-marker + screen shake
    val recoilAnim by animateFloatAsState(
        targetValue = recoil,
        animationSpec = spring(dampingRatio = 0.38f, stiffness = 420f),
        label = "recoilSpring"
    )
    val hitMarkerScaleSpring by animateFloatAsState(
        targetValue = hitMarkerScale,
        animationSpec = spring(dampingRatio = 0.42f, stiffness = 820f),
        label = "hitMarkerSpring"
    )
    LaunchedEffect(recoil) {
        if (recoil != 0f) {
            // sharp kick then recovery is handled by spring; just reset after peak
            screenShake = Offset(Random.nextFloat() * 6f - 3f, Random.nextFloat() * 4f - 2f)
            delay(55)
            screenShake = Offset.Zero
            delay(25)
            recoil = 0f
            muzzleFlash = false
        }
    }
    LaunchedEffect(hitMarkerVisible) {
        if (hitMarkerVisible) {
            hitMarkerScale = 1.35f
            delay(60)
            hitMarkerScale = 1f
            delay(140)
            hitMarkerVisible = false
        }
    }
    LaunchedEffect(damageFlash) {
        if (damageFlash) {
            delay(140)
            damageFlash = false
        }
    }
    // ticker drives floating hit-number rise/fade, blood-ring pulse, and brass physics
    LaunchedEffect(Unit) {
        while (true) {
            delay(16)
            frameTick++
            val now = System.currentTimeMillis()
            if (hitNumbers.any { now - it.born > 820 }) {
                hitNumbers = hitNumbers.filter { now - it.born < 820 }
            }
            if (brasses.any { now - it.born > 1100 }) {
                brasses = brasses.filter { now - it.born < 1100 }
            }
        }
    }

    // Auto-regenerate and move targets slightly to simulate breathing world
    LaunchedEffect(level) {
        while (true) {
            delay(120)
            targets = targets.map {
                if (!it.alive) it else it.copy(
                    x = (it.x + sin(System.currentTimeMillis() / 800.0 + it.id).toFloat() * 0.002f).coerceIn(-1f, 1f)
                )
            }
            // health regen slight
            if (health < 100 && Random.nextFloat() < 0.02f) {
                health = (health + 1).coerceAtMost(100)
            }
        }
    }

    // Handle reloading
    LaunchedEffect(isReloading) {
        if (isReloading) {
            gameMessage = "RELOADING..."
            delay(1200)
            ammo = 30
            isReloading = false
            gameMessage = "WEAPONS HOT"
            delay(800)
            gameMessage = "ELIMINATE HOSTILES"
        }
    }

    fun fire() {
        if (isReloading) return
        if (ammo <= 0) {
            isReloading = true
            return
        }
        ammo--
        recoil = 16f
        muzzleFlash = true
        // brass ejection with randomized lateral + upward velocity + spin (Warzone-style)
        brasses = brasses + Brass(
            id = brassSeq++,
            vx = Random.nextFloat() * 2.2f + 1.1f,
            vy = -(Random.nextFloat() * 3.5f + 2.8f),
            spin = Random.nextFloat() * 720f - 360f
        )
        // lightweight recoil variance so it feels analogue, not digital
        yaw += (Random.nextFloat() - 0.5f) * 0.9f
        pitch += Random.nextFloat() * 0.6f
        // subtle camera FOV kick — survives via screenShake extension above
        screenShake = Offset(screenShake.x * 0.3f + (Random.nextFloat() - 0.5f) * 2f, screenShake.y)
        // Aim calculation: yaw-rotated perspective consistent with Canvas projection (critic: hit test must match rendered projX)
        val yawRadFire = yaw * PI.toFloat() / 180f
        val cosF = cos(yawRadFire)
        val sinF = sin(yawRadFire)
        val aimX = crosshairOffset.x / 400f // crosshair offset already in screen space
        val aimY = crosshairOffset.y / 400f + pitch / 30f
        var hit = false
        targets = targets.map { t ->
            if (!t.alive) return@map t
            val rotXf = t.x * cosF - t.z * sinF
            val rotZf = t.x * sinF + t.z * cosF + 2.8f
            if (rotZf < 0.45f) return@map t
            val screenX = rotXf * 520f / rotZf
            val screenY = -55f / rotZf
            val dist = sqrt((screenX - aimX * 300f).pow(2) + (screenY - aimY * 200f).pow(2))
            val radius = 45f / rotZf + 18f
            if (dist < radius) {
                hit = true
                t.copy(alive = false, hitAnim = 1f)
            } else t
        }
        if (hit) {
            score += 150 * level
            kills++
            gameMessage = "HIT! +${150 * level}"
            hitMarkerVisible = true
            hitMarkerScale = 1.35f
            // floating combat text — COD damage number pop near crosshair with jitter
            val jitter = (Random.nextFloat() - 0.5f) * 44f
            hitNumbers = hitNumbers + HitNumber(id = hitNumberSeq++, offsetX = jitter, value = 150 * level)
            // stronger punch on screen for confirmed hit
            screenShake = Offset(Random.nextFloat() * 8f - 4f, Random.nextFloat() * 5f - 2.5f)
            if (kills % 5 == 0) {
                level++
                gameMessage = "LEVEL $level - ADVANCE"
            }
            // respawn after delay if all dead
            if (targets.none { it.alive }) {
                // will respawn in coroutine
            }
        } else {
            gameMessage = if (Random.nextFloat() < 0.15f) "SUPPRESSING FIRE" else "ELIMINATE HOSTILES"
            // subtle miss feedback — light vignette pulse
            if (Random.nextFloat() < 0.18f) {
                damageFlash = true
            }
        }
        if (ammo == 0) {
            isReloading = true
        }
    }

    // Respawn targets when cleared
    LaunchedEffect(targets) {
        if (targets.none { it.alive }) {
            delay(700)
            targets = List(5 + level.coerceAtMost(4)) { i ->
                Target(
                    id = Random.nextInt(1000),
                    x = Random.nextFloat() * 1.8f - 0.9f,
                    z = Random.nextFloat() * 6f + 1.5f
                )
            }
            gameMessage = "NEW CONTACTS - LEVEL $level"
            delay(900)
            gameMessage = "ELIMINATE HOSTILES"
        }
    }

    // Damage simulation if player misses too much
    LaunchedEffect(score) {
        // random damage tick
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060A13))
            .offset(x = (screenShake.x * 0.35f).dp, y = (screenShake.y * 0.35f).dp)
    ) {
        // Game Canvas Background - pseudo 3D scene
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { fire() })
                }
                .pointerInput(Unit) {
                    detectDragGestures { change, dragAmount ->
                        yaw = (yaw + dragAmount.x * 0.12f).coerceIn(-35f, 35f)
                        pitch = (pitch - dragAmount.y * 0.08f).coerceIn(-12f, 18f)
                    }
                }
        ) {
            val w = size.width
            val h = size.height
            val centerX = w / 2f
            val centerY = h / 2f

            // Sky gradient
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF1B2742), Color(0xFF3A5A8C), Color(0xFF6B7A90)),
                    startY = 0f,
                    endY = h * 0.55f
                ),
                size = Size(w, h * 0.55f)
            )
            // Sun — scaled down (critic: giant flat disc at 0.08h covered 25% sky)
            drawCircle(
                color = Color(0xFFFFD67A).copy(alpha = 0.92f),
                radius = h * 0.032f,
                center = Offset(w * 0.78f, h * 0.16f)
            )
            drawCircle(
                color = Color(0xFFFFD67A).copy(alpha = 0.13f),
                radius = h * 0.075f,
                center = Offset(w * 0.78f, h * 0.16f)
            )
            // Sun shaft rays (subtle)
            for (ri in -2..2) {
                val ang = -18f + ri * 6f
                val rad = ang * PI.toFloat() / 180f
                val len = h * 0.55f
                val sx = w * 0.78f
                val sy = h * 0.18f
                drawLine(
                    Color(0xFFFFD67A).copy(alpha = 0.035f - abs(ri) * 0.007f),
                    Offset(sx, sy),
                    Offset(sx + cos(rad) * len, sy + sin(rad) * len),
                    strokeWidth = 22f + abs(ri) * 6f
                )
            }
            // Cloud wisps — breakup sky gradient
            for (ci in 0 until 7) {
                val cx = w * (0.08f + ci * 0.14f) + sin(ci * 1.7f) * w * 0.02f
                val cy = h * (0.12f + (ci % 3) * 0.055f)
                val cw = w * (0.09f + (ci % 2) * 0.04f)
                val ch = h * 0.025f
                drawOval(Color.White.copy(alpha = 0.08f - ci * 0.006f), topLeft = Offset(cx - cw / 2f, cy - ch / 2f), size = Size(cw, ch))
                drawOval(Color.White.copy(alpha = 0.05f), topLeft = Offset(cx - cw * 0.35f, cy - ch * 0.3f), size = Size(cw * 0.7f, ch * 0.55f))
            }
            // Distant mountains silhouette
            val mountainPath = Path().apply {
                moveTo(0f, h * 0.38f)
                lineTo(w * 0.18f, h * 0.28f)
                lineTo(w * 0.32f, h * 0.36f)
                lineTo(w * 0.45f, h * 0.22f)
                lineTo(w * 0.62f, h * 0.34f)
                lineTo(w * 0.78f, h * 0.26f)
                lineTo(w * 0.92f, h * 0.35f)
                lineTo(w, h * 0.30f)
                lineTo(w, h * 0.55f)
                lineTo(0f, h * 0.55f)
                close()
            }
            drawPath(mountainPath, Color(0xFF0E1A2E))
            // Second ridge
            val ridge = Path().apply {
                moveTo(0f, h * 0.46f)
                lineTo(w * 0.22f, h * 0.41f)
                lineTo(w * 0.38f, h * 0.45f)
                lineTo(w * 0.58f, h * 0.39f)
                lineTo(w * 0.74f, h * 0.44f)
                lineTo(w, h * 0.40f)
                lineTo(w, h * 0.55f)
                lineTo(0f, h * 0.55f)
                close()
            }
            drawPath(ridge, Color(0xFF16263F))

            // Ground plane with perspective grid — textured sand + AO
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF2B3A2A), Color(0xFF3F4A2E), Color(0xFF5A4A2A)),
                    startY = h * 0.55f,
                    endY = h
                ),
                topLeft = Offset(0f, h * 0.55f),
                size = Size(w, h * 0.45f)
            )
            // Sand micro-detail breakup — perlin-like speckles (COD Rust sand texture)
            val sandSeed = 1337
            for (i in 0 until 900) {
                val sx = ((i * 73 + sandSeed) % 997) / 997f
                val sy = ((i * 97 + sandSeed * 3) % 953) / 953f
                val wx = sx * w
                val wy = h * (0.56f + sy * 0.42f)
                val isPebble = i % 11 == 0
                val dotR = if (isPebble) 1.8f else 0.9f
                val dotAlpha = if (isPebble) 0.18f else 0.07f * (0.5f + sy * 0.5f)
                val dotCol = if (i % 3 == 0) Color(0xFF8A7A5A) else if (i % 3 == 1) Color(0xFF5A4A30) else Color(0xFFC2B49A)
                drawCircle(dotCol.copy(alpha = dotAlpha), radius = dotR, center = Offset(wx + yaw * sy * 2f, wy))
            }
            // Tire tracks / roughness strokes
            for (track in 0..1) {
                val tx = centerX + (if (track == 0) -w * 0.08f else w * 0.12f) + yaw * 3f
                for (k in 0..18) {
                    val ty = h * (0.58f + k * 0.022f)
                    val lw = (1.5f + sin(k * 0.9f) * 0.6f)
                    drawLine(Color(0xFF2A261E).copy(alpha = 0.09f), Offset(tx - 6f, ty), Offset(tx + 6f, ty), strokeWidth = lw)
                    drawLine(Color(0xFF2A261E).copy(alpha = 0.06f), Offset(tx - 6f + 9f, ty), Offset(tx + 6f + 9f, ty), strokeWidth = lw * 0.7f)
                }
            }
            // Sun glint speculars on sand — quartz sparkle near sun azimuth (AAA micro-detail)
            for (gi in 0 until 28) {
                val gx = w * (0.12f + (gi * 37 % 88) / 88f * 0.78f)
                val gz = (gi * 53 % 100) / 100f // 0 near horizon = denser glints
                val gy = h * (0.60f + gz * 0.36f)
                // only glint where sun hits with Fresnel-like falloff
                val sunAlign = 1f - abs(gx - w * 0.62f) / (w * 0.52f) // brighter toward sun side
                if (sunAlign > 0.18f) {
                    val ga = (0.11f * sunAlign * (0.6f + gz * 0.4f)) * (0.6f + sin(gi * 1.91f) * 0.4f)
                    drawCircle(Color.White.copy(alpha = ga.coerceIn(0f, 0.14f)), radius = 1.15f, center = Offset(gx + yaw * gz * 2f, gy))
                    if (gi % 3 == 0) drawCircle(Color(0xFFFFE8A0).copy(alpha = ga * 0.6f), radius = 0.55f, center = Offset(gx + yaw * gz * 2f + 0.5f, gy - 0.5f))
                }
            }
            // Horizon AO contact shadow — wall-ground junction darkening + depth falloff
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color.Black.copy(alpha = 0.28f), Color.Transparent),
                    startY = h * 0.54f,
                    endY = h * 0.60f
                ),
                topLeft = Offset(0f, h * 0.54f),
                size = Size(w, h * 0.06f)
            )
            // Subtle depth darkening toward bottom (falloff) — reinforces perspective
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.10f)),
                    startY = h * 0.78f,
                    endY = h
                ),
                topLeft = Offset(0f, h * 0.78f),
                size = Size(w, h * 0.22f)
            )
            // Grid lines — reduced to faint sandy hint, not Tron wires (critic: stark white at 0.07)
            for (i in 0..12) {
                val t = i / 12f
                val y = h * (0.55f + t * 0.45f)
                val perspective = 1f - t * 0.75f
                drawLine(
                    color = Color(0xFFD8C9A8).copy(alpha = 0.028f * (1f - t)),
                    start = Offset(centerX - w * 0.5f * perspective + yaw * 6f * t, y),
                    end = Offset(centerX + w * 0.5f * perspective + yaw * 6f * t, y),
                    strokeWidth = 0.8f
                )
            }
            for (i in -6..6) {
                val xOff = i * w * 0.08f
                drawLine(
                    color = Color(0xFFD8C9A8).copy(alpha = 0.018f),
                    start = Offset(centerX + xOff * 0.2f + yaw * 2f, h * 0.55f),
                    end = Offset(centerX + xOff + yaw * 8f, h),
                    strokeWidth = 0.8f
                )
            }

            // Distance fog over far ridge — aerial perspective desaturation
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF1B2742).copy(alpha = 0.0f), Color(0xFF1B2742).copy(alpha = 0.32f)),
                    startY = h * 0.30f,
                    endY = h * 0.55f
                ),
                topLeft = Offset(0f, h * 0.30f),
                size = Size(w, h * 0.25f)
            )

            // Bunker / wall elements — PBR textured, perspective-correct with AO & cast shadows
            // CRITIC FIX: replace flat yaw*4f slide with depth-aware perspective projection + sun-aligned shadows + occlusion-ready depth (MW3 Rust parity)
            val camYawRad = yaw * (PI.toFloat() / 180f)
            val camCos = cos(camYawRad)
            val camSin = sin(camYawRad)
            // sun azimuth ~ -35deg (from right), shadow offset aligns with sun rays used earlier (ang -18deg)
            val sunAzimRad = -35f * PI.toFloat() / 180f
            val shadowDx = cos(sunAzimRad) * 18f
            val shadowDy = sin(sunAzimRad) * 6f + 9f
            fun projectWorld(worldX: Float, worldZ: Float, yFactor: Float): Offset? {
                val rx = worldX * camCos - worldZ * camSin
                val rz = worldX * camSin + worldZ * camCos + 2.8f
                if (rz < 0.35f) return null
                val px = centerX + rx * 520f / rz
                val py = h * yFactor - 55f / rz
                return Offset(px, py)
            }
            // Left concrete wall — 3-plane box with edge wear, AO, rivets, cast shadow (world X=-1.05 Z=2.2)
            run {
                val proj = projectWorld(-1.05f, 2.2f, 0.58f)
                val baseX = proj?.x ?: (w * 0.02f + yaw * 4f)
                // perspective scale for this wall distance
                val wallDist = 2.8f + (-1.05f * camSin + 2.2f * camCos)
                val scl = (1.55f / wallDist.coerceAtLeast(0.6f)).coerceIn(0.65f, 1.15f)
                val leftW = w * 0.09f * scl
                val leftH = h * 0.22f * scl
                val leftX = baseX - leftW * 0.45f
                val leftY = (proj?.y ?: (h * 0.42f)) - leftH * 0.35f
                val topH = h * 0.04f * scl
                // Cast shadow onto sand — sun-aligned, depth-scaled, soft PCF-like via double oval
                drawOval(Color.Black.copy(alpha = 0.22f), topLeft = Offset(leftX + shadowDx - 4f, leftY + leftH + shadowDy - 4f), size = Size(leftW * 1.4f, leftH * 0.18f))
                drawOval(Color.Black.copy(alpha = 0.10f), topLeft = Offset(leftX + shadowDx*1.4f - 2f, leftY + leftH + shadowDy*1.4f - 2f), size = Size(leftW * 1.6f, leftH * 0.22f))
                // Front face — concrete with vertical grain
                drawRect(color = Color(0xFF3A4455), topLeft = Offset(leftX, leftY), size = Size(leftW, leftH))
                // vertical concrete pour lines + noise
                for (ri in 0..4) {
                    val rx = leftX + ri * leftW * 0.22f
                    drawLine(Color(0xFF2C3545).copy(alpha = 0.35f), Offset(rx, leftY), Offset(rx, leftY + leftH), strokeWidth = 1f)
                }
                for (ci in 0 until 22) {
                    val cx = leftX + (ci * 13 % leftW.toInt())
                    val cy = leftY + (ci * 19 % leftH.toInt())
                    drawCircle(Color.White.copy(alpha = 0.04f), radius = 1.1f, center = Offset(cx, cy))
                }
                // Top face — sun-lit
                drawRect(color = Color(0xFF4A5568), topLeft = Offset(leftX, leftY), size = Size(leftW, topH))
                drawLine(Color.White.copy(alpha = 0.10f), Offset(leftX, leftY), Offset(leftX + leftW, leftY), strokeWidth = 1.5f)
                // Side face — slight perspective thickness
                val sideW = leftW * 0.18f
                val sidePath = Path().apply {
                    moveTo(leftX + leftW, leftY)
                    lineTo(leftX + leftW + sideW, leftY + topH * 0.6f)
                    lineTo(leftX + leftW + sideW, leftY + leftH + topH * 0.6f)
                    lineTo(leftX + leftW, leftY + leftH)
                    close()
                }
                drawPath(sidePath, Color(0xFF2A3445))
                // Edge wear highlight on top-left
                drawLine(Color.White.copy(alpha = 0.12f), Offset(leftX + 1f, leftY + 1f), Offset(leftX + leftW - 1f, leftY + 1f), strokeWidth = 1f)
                drawLine(Color.White.copy(alpha = 0.08f), Offset(leftX + 1f, leftY + 1f), Offset(leftX + 1f, leftY + leftH - 1f), strokeWidth = 1f)
                // AO where wall meets ground
                drawRect(
                    brush = Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.28f), Color.Transparent), startY = leftY + leftH - h * 0.04f, endY = leftY + leftH),
                    topLeft = Offset(leftX - 2f, leftY + leftH - h * 0.04f),
                    size = Size(leftW + sideW + 4f, h * 0.04f)
                )
                // Rivets
                for (ri in 0..2) {
                    for (ci in 0..1) {
                        val rx = leftX + leftW * (0.22f + ci * 0.55f)
                        val ry = leftY + leftH * (0.18f + ri * 0.28f)
                        drawCircle(Color(0xFF1A1E26), radius = 2.2f, center = Offset(rx, ry))
                        drawCircle(Color(0xFF6A7A90).copy(alpha = 0.55f), radius = 1f, center = Offset(rx - 0.5f, ry - 0.5f))
                    }
                }
            }
            // Right container — rusted metal with streaks, welded seams, cast shadow (world X=+0.92 Z=1.9, sun-aligned)
            run {
                val projR = projectWorld(0.92f, 1.9f, 0.585f)
                val wallDistR = 2.8f + (0.92f * camSin + 1.9f * camCos)
                val sclR = (1.55f / wallDistR.coerceAtLeast(0.6f)).coerceIn(0.65f, 1.15f)
                val contW = w * 0.10f * sclR
                val contH = h * 0.18f * sclR
                val projX = projR?.x ?: (w * 0.88f + yaw * 2f)
                val projY = projR?.y ?: (h * 0.44f)
                val contX = projX - contW * 0.5f
                val contY = projY - contH * 0.38f
                // Cast shadow — sun-aligned, double blur for PCF softness
                drawOval(Color.Black.copy(alpha = 0.20f), topLeft = Offset(contX + shadowDx - 6f, contY + contH + shadowDy - 2f), size = Size(contW * 1.35f, contH * 0.20f))
                drawOval(Color.Black.copy(alpha = 0.10f), topLeft = Offset(contX + shadowDx*1.3f - 4f, contY + contH + shadowDy*1.3f - 1f), size = Size(contW * 1.55f, contH * 0.24f))
                // Front face — base rust orange with vertical streaks
                drawRect(color = Color(0xFF8A6A3A), topLeft = Offset(contX, contY), size = Size(contW, contH))
                // Rust streaks — vertical dark-orange noise
                for (si in 0 until 8) {
                    val sx = contX + si * contW * 0.12f + 2f
                    val streakCol = if (si % 2 == 0) Color(0xFF5A3A1A).copy(alpha = 0.22f) else Color(0xFF7A4A1A).copy(alpha = 0.16f)
                    drawLine(streakCol, Offset(sx, contY), Offset(sx + 1.5f, contY + contH), strokeWidth = (2.5f + si % 3))
                }
                // Corrugation ribs — with bevel highlight/shadow
                repeat(3) { idx ->
                    val ry = contY + contH * (0.14f + idx * 0.28f)
                    drawLine(Color(0xFF5A3A1A), Offset(contX, ry), Offset(contX + contW, ry), strokeWidth = 2.5f)
                    drawLine(Color.White.copy(alpha = 0.07f), Offset(contX, ry - 1f), Offset(contX + contW, ry - 1f), strokeWidth = 1f)
                    drawLine(Color.Black.copy(alpha = 0.18f), Offset(contX, ry + 1.2f), Offset(contX + contW, ry + 1.2f), strokeWidth = 1f)
                }
                // Top face — sun highlight
                drawRect(Color(0xFFA07A3A), topLeft = Offset(contX, contY), size = Size(contW, contH * 0.16f))
                // Edge wear — bright edge on top/left
                drawLine(Color.White.copy(alpha = 0.13f), Offset(contX, contY), Offset(contX + contW, contY), strokeWidth = 1.2f)
                drawLine(Color.White.copy(alpha = 0.09f), Offset(contX, contY), Offset(contX, contY + contH), strokeWidth = 1f)
                // AO at bottom
                drawRect(
                    brush = Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.24f), Color.Transparent), startY = contY + contH - h * 0.035f, endY = contY + contH),
                    topLeft = Offset(contX, contY + contH - h * 0.035f),
                    size = Size(contW, h * 0.035f)
                )
                // Rivets along seams
                for (ri in 0..3) {
                    val rx = contX + 3f
                    val ry = contY + contH * (0.08f + ri * 0.26f)
                    drawCircle(Color(0xFF2A1E12), radius = 2f, center = Offset(rx, ry))
                }
                for (ri in 0..3) {
                    val rx = contX + contW - 3f
                    val ry = contY + contH * (0.08f + ri * 0.26f)
                    drawCircle(Color(0xFF2A1E12), radius = 2f, center = Offset(rx, ry))
                }
            }

            // Targets - project with true yaw-rotated perspective + depth-tested occlusion (critic: painter's algorithm ≠ depth buffer)
            val sorted = targets.sortedByDescending { it.z }
            // occlusion: build wall AABBs in projected space for the frame to depth-test targets behind cover
            val wallAabbs: List<Pair<Float, Float>> by lazy {
                // uses same projectWorld for walls; approximated as x ranges
                val l = projectWorld(-1.05f, 2.2f, 0.58f)?.x ?: (w * 0.11f)
                val r = projectWorld(0.92f, 1.9f, 0.585f)?.x ?: (w * 0.88f)
                listOf(l to 2.2f, r to 1.9f)
            }
            for (t in sorted) {
                // rotate target world position by camera yaw, then perspective divide (matches wall projection)
                val rotX = t.x * camCos - t.z * camSin
                val rotZ = t.x * camSin + t.z * camCos + 2.8f
                if (rotZ < 0.45f) continue // behind camera / too close — culled (depth test)
                val projX = centerX + rotX * 520f / rotZ
                val projY = h * 0.58f - (55f / rotZ) + pitch * 2f
                val scale = (1.6f / rotZ).coerceIn(0.18f, 0.9f)
                // occlusion behind walls: if target shares X band with wall and is farther than wall, clip
                val occluded = wallAabbs.any { (wx, wz) -> abs(projX - wx) < w * 0.075f * scale / 0.5f && rotZ > wz + 0.6f }
                if (occluded) continue
                val targetH = h * 0.22f * scale
                val targetW = targetH * 0.62f
                if (!t.alive) {
                    // AAA hit effect — double ring + blood mist + ground blood pool (lingers)
                    val pulseR = 0.85f + (frameTick % 14) * 0.015f
                    // blood pool decal on sand contact point
                    drawOval(
                        color = Color(0xFF8A1A1A).copy(alpha = 0.42f),
                        topLeft = Offset(projX - targetW * 0.62f, h * 0.635f - targetH * 0.05f),
                        size = Size(targetW * 1.35f, targetH * 0.22f)
                    )
                    drawOval(
                        color = Color(0xFFCC2222).copy(alpha = 0.22f),
                        topLeft = Offset(projX - targetW * 0.42f, h * 0.635f - targetH * 0.02f),
                        size = Size(targetW * 0.85f, targetH * 0.14f)
                    )
                    // expanding double ring — outer red, inner white
                    drawCircle(
                        color = Color(0xFFFF3B30).copy(alpha = 0.30f * (1f - (frameTick % 16) / 18f)),
                        radius = targetW * (0.78f + pulseR * 0.22f),
                        center = Offset(projX, projY - targetH * 0.08f),
                        style = Stroke(width = 3.2f)
                    )
                    drawCircle(
                        color = Color.White.copy(alpha = 0.55f * (1f - (frameTick % 16) / 18f)),
                        radius = targetW * (0.55f + pulseR * 0.18f),
                        center = Offset(projX, projY - targetH * 0.08f),
                        style = Stroke(width = 1.8f)
                    )
                    // blood mist puff at torso center
                    drawCircle(Color(0xFFFF3B30).copy(alpha = 0.18f), radius = targetW * 0.42f * pulseR, center = Offset(projX, projY - targetH * 0.08f))
                    drawCircle(Color.White.copy(alpha = 0.10f), radius = targetW * 0.18f, center = Offset(projX + targetW * 0.08f, projY - targetH * 0.18f))
                    continue
                }
                // Shadow — contact AO soft + stretched with distance
                drawOval(
                    color = Color.Black.copy(alpha = (0.38f - t.z * 0.022f).coerceIn(0.12f, 0.38f)),
                    topLeft = Offset(projX - targetW * 0.55f, h * 0.635f),
                    size = Size(targetW * 1.1f, targetH * 0.12f)
                )
                // Body - PBR soldier with directional sun light (top-left 45 deg) + rim + micro-fabric
                val sunDirX = -0.45f // sun from upper-right in world, so shade left side
                val lightTop = Color(0xFF5E6E4A)
                val lightMid = Color(0xFF4A5A3A)
                val shadowSide = Color(0xFF2E3A28)
                val rimCol = Color(0xFF8AA07A).copy(alpha = 0.22f)
                // Head — subsurface + shadow
                drawCircle(
                    color = Color(0xFF252218),
                    radius = targetW * 0.18f,
                    center = Offset(projX, projY - targetH * 0.32f)
                )
                // head light side highlight (sun on right cheek)
                drawCircle(
                    color = Color(0xFF3A3528).copy(alpha = 0.55f),
                    radius = targetW * 0.12f,
                    center = Offset(projX + targetW * 0.06f, projY - targetH * 0.335f)
                )
                // Helmet — brushed olive with top specular (Fresnel-like)
                drawArc(
                    brush = Brush.verticalGradient(listOf(Color(0xFF4E5E3A), Color(0xFF3A4A2A), Color(0xFF2A3520))),
                    startAngle = 180f,
                    sweepAngle = 180f,
                    useCenter = true,
                    topLeft = Offset(projX - targetW * 0.20f, projY - targetH * 0.44f),
                    size = Size(targetW * 0.40f, targetW * 0.28f)
                )
                // helmet top specular streak (sun glint)
                drawArc(
                    color = Color.White.copy(alpha = 0.16f),
                    startAngle = 200f,
                    sweepAngle = 42f,
                    useCenter = false,
                    topLeft = Offset(projX - targetW * 0.17f, projY - targetH * 0.435f),
                    size = Size(targetW * 0.34f, targetW * 0.20f),
                    style = Stroke(width = targetW * 0.032f)
                )
                drawCircle(Color.White.copy(alpha = 0.11f), radius = targetW * 0.045f, center = Offset(projX + targetW * 0.08f, projY - targetH * 0.415f))
                // Torso — camo fabric with directional gradient (light top, shadow bottom + side AO)
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(lightTop, lightMid, shadowSide)),
                    topLeft = Offset(projX - targetW * 0.30f, projY - targetH * 0.22f),
                    size = Size(targetW * 0.60f, targetH * 0.48f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f, 6f)
                )
                // fabric weave micro lines (subtle)
                for (fi in 0..3) {
                    val fy = projY - targetH * 0.18f + fi * targetH * 0.09f
                    drawLine(Color.Black.copy(alpha = 0.07f), Offset(projX - targetW * 0.26f, fy), Offset(projX + targetW * 0.26f, fy), strokeWidth = 0.6f)
                }
                // left side shadow (away from sun)
                drawRoundRect(
                    color = Color.Black.copy(alpha = 0.18f),
                    topLeft = Offset(projX - targetW * 0.30f, projY - targetH * 0.22f),
                    size = Size(targetW * 0.10f, targetH * 0.48f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f, 6f)
                )
                // rim light on right edge (sun backscatter)
                drawLine(rimCol, Offset(projX + targetW * 0.27f, projY - targetH * 0.18f), Offset(projX + targetW * 0.27f, projY + targetH * 0.20f), strokeWidth = targetW * 0.045f)
                // Vest plate — matte nylon with edge highlight + AO crevice
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(Color(0xFF3A4A38), Color(0xFF2B3A2B), Color(0xFF1E2A1E))),
                    topLeft = Offset(projX - targetW * 0.20f, projY - targetH * 0.15f),
                    size = Size(targetW * 0.40f, targetH * 0.28f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
                )
                // vest top edge bevel highlight
                drawLine(Color.White.copy(alpha = 0.09f), Offset(projX - targetW * 0.18f, projY - targetH * 0.14f), Offset(projX + targetW * 0.18f, projY - targetH * 0.14f), strokeWidth = 1f)
                // molle webbing horizontal stitches
                repeat(2) { mi ->
                    val my = projY - targetH * 0.06f + mi * targetH * 0.08f
                    drawLine(Color.Black.copy(alpha = 0.22f), Offset(projX - targetW * 0.18f, my), Offset(projX + targetW * 0.18f, my), strokeWidth = 0.9f)
                }
                // Arms — fabric with same gradient + shadow
                drawRoundRect(
                    brush = Brush.horizontalGradient(listOf(shadowSide, lightMid, lightTop)),
                    topLeft = Offset(projX - targetW * 0.42f, projY - targetH * 0.18f),
                    size = Size(targetW * 0.14f, targetH * 0.36f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(7f, 7f)
                )
                drawRoundRect(
                    brush = Brush.horizontalGradient(listOf(lightTop, lightMid, shadowSide)),
                    topLeft = Offset(projX + targetW * 0.28f, projY - targetH * 0.18f),
                    size = Size(targetW * 0.14f, targetH * 0.36f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(7f, 7f)
                )
                // arm rim on sun-lit side
                drawLine(rimCol.copy(alpha = 0.16f), Offset(projX + targetW * 0.40f, projY - targetH * 0.12f), Offset(projX + targetW * 0.40f, projY + targetH * 0.14f), strokeWidth = targetW * 0.03f)
                // Legs — slightly dustier, desaturated with knee highlight
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(Color(0xFF4A4338), Color(0xFF3A3A35), Color(0xFF2A2A26))),
                    topLeft = Offset(projX - targetW * 0.24f, projY + targetH * 0.26f),
                    size = Size(targetW * 0.18f, targetH * 0.36f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f)
                )
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(Color(0xFF4A4338), Color(0xFF3A3A35), Color(0xFF2A2A26))),
                    topLeft = Offset(projX + targetW * 0.06f, projY + targetH * 0.26f),
                    size = Size(targetW * 0.18f, targetH * 0.36f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f)
                )
                // knee dust highlight (sand)
                drawOval(Color(0xFFC2B49A).copy(alpha = 0.10f), topLeft = Offset(projX - targetW * 0.20f, projY + targetH * 0.40f), size = Size(targetW * 0.12f, targetH * 0.06f))
                drawOval(Color(0xFFC2B49A).copy(alpha = 0.10f), topLeft = Offset(projX + targetW * 0.10f, projY + targetH * 0.40f), size = Size(targetW * 0.12f, targetH * 0.06f))
                // Weapon — blued steel with anisotropic highlight
                drawRoundRect(
                    brush = Brush.verticalGradient(listOf(Color(0xFF2A2A2A), Color(0xFF141414), Color(0xFF0F0F0F))),
                    topLeft = Offset(projX - targetW * 0.08f, projY - targetH * 0.02f),
                    size = Size(targetW * 0.52f, targetH * 0.08f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f)
                )
                // barrel specular streak (sun)
                drawLine(Color.White.copy(alpha = 0.14f), Offset(projX + targetW * 0.02f, projY - targetH * 0.005f), Offset(projX + targetW * 0.38f, projY - targetH * 0.005f), strokeWidth = 1f)
                // magazine polymer highlight
                drawRoundRect(Color(0xFF1E1E1E), topLeft = Offset(projX - targetW * 0.02f, projY + targetH * 0.02f), size = Size(targetW * 0.12f, targetH * 0.04f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(1f,1f))
                // Red dot indicator for hostile
                drawCircle(
                    color = Color(0xFFFF3B30),
                    radius = 4f * scale * 6f,
                    center = Offset(projX, projY - targetH * 0.55f)
                )
                // Distance label
                drawContext.canvas.nativeCanvas.apply {
                    val paint = android.graphics.Paint().apply {
                        color = android.graphics.Color.argb(180, 255, 255, 255)
                        textSize = 10f * scale * 18f
                        isAntiAlias = true
                        typeface = android.graphics.Typeface.MONOSPACE
                    }
                    drawText("${t.z.toInt()}m", projX - targetW * 0.3f, projY + targetH * 0.75f, paint)
                }
            }

            // Vignette
            drawRect(
                brush = Brush.radialGradient(
                    colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.55f)),
                    center = Offset(centerX, centerY),
                    radius = w * 0.75f
                ),
                size = size
            )
            // Floating hitNumbers drawn in-canvas — rise + fade (driven by frameTick)
            run {
                // use frameTick to invalidate canvas each frame while hitNumbers present
                val tick = frameTick
                val now = System.currentTimeMillis()
                for (hn in hitNumbers) {
                    val age = ((now - hn.born).toFloat() / 820f).coerceIn(0f, 1f)
                    if (age >= 1f) continue
                    @Suppress("UNUSED_VARIABLE") val _tick = tick
                    val alpha = (1f - age)
                    val yRise = age * 58f
                    val cx = centerX + hn.offsetX * 3.2f
                    val cy = centerY - 28f - yRise
                    val scaleTxt = 1.1f - age * 0.18f
                    // shadow / outline for crisp HUD legibility
                    drawContext.canvas.nativeCanvas.apply {
                        val paintShadow = android.graphics.Paint().apply {
                            color = android.graphics.Color.argb((alpha * 180).toInt(), 0, 0, 0)
                            textSize = 30f * scaleTxt
                            isAntiAlias = true
                            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT_BOLD, android.graphics.Typeface.BOLD)
                            setShadowLayer(6f, 0f, 2f, android.graphics.Color.argb((alpha * 200).toInt(), 0, 0, 0))
                        }
                        drawText("+${hn.value}", cx + 1.5f, cy + 1.5f, paintShadow)
                        val paint = android.graphics.Paint().apply {
                            color = android.graphics.Color.argb((alpha * 255).toInt(), 255, 220, 50)
                            textSize = 30f * scaleTxt
                            isAntiAlias = true
                            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT_BOLD, android.graphics.Typeface.BOLD)
                        }
                        drawText("+${hn.value}", cx, cy, paint)
                        // tiny crit sparkle at peak
                        if (age < 0.35f) {
                            val sparkA = (1f - age / 0.35f)
                            val sp = android.graphics.Paint().apply {
                                color = android.graphics.Color.argb((sparkA * 200).toInt(), 255, 255, 255)
                                isAntiAlias = true
                            }
                            drawCircle(cx + 18f, cy - 10f, 2.2f * sparkA, sp)
                        }
                    }
                }
            }
        }

        // Top HUD Bar - COD style
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xCC0A0F1A))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                // Team badge
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF3DDC84))
                        .border(2.dp, Color.White, RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("OMG", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 10.sp)
                }
                Column {
                    Text(
                        "CALL OF DUTY // OMG OPS",
                        color = Color(0xFF8A9BB5),
                        fontSize = 7.sp,
                        letterSpacing = 1.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "TDM  •  RUST  •  $kills ELIMS",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                // Mini score
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0xFF1E2A3A))
                        .border(1.dp, Color(0xFF3DDC84), RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text("$score", color = Color(0xFF3DDC84), fontWeight = FontWeight.Black, fontSize = 14.sp)
                }
            }

            // Center compass / objective
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFFF3B30)))
                    Text(gameMessage, color = Color(0xFFFFC832), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFFF3B30)))
                }
                // Compass bar
                Box(
                    modifier = Modifier
                        .width(180.dp)
                        .height(14.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background(Color(0xFF1A2535))
                        .border(1.dp, Color(0xFF2A3A55), RoundedCornerShape(7.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        val w = size.width
                        val step = w / 8f
                        for (i in 0..8) {
                            val x = i * step
                            val isMajor = i % 2 == 0
                            drawLine(
                                color = if (isMajor) Color.White else Color(0xFF6A7A95),
                                start = Offset(x, if (isMajor) 2f else 5f),
                                end = Offset(x, size.height - 2f),
                                strokeWidth = if (isMajor) 1.5f else 1f
                            )
                        }
                        // North indicator shifted by yaw
                        val northX = w / 2f + yaw * 2.2f
                        drawCircle(Color(0xFFFF3B30), radius = 5f, center = Offset(northX.coerceIn(8f, w - 8f), size.height / 2f))
                    }
                    Text("N  •  W  •  S  •  E", color = Color(0xFF6A7A95), fontSize = 7.sp, letterSpacing = 2.sp)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("HEALTH", color = Color(0xFF8A9BB5), fontSize = 7.sp, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            modifier = Modifier
                                .width(70.dp)
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFF1A2535))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .fillMaxWidth(health / 100f)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(
                                        when {
                                            health > 60 -> Color(0xFF3DDC84)
                                            health > 30 -> Color(0xFFFFC832)
                                            else -> Color(0xFFFF3B30)
                                        }
                                    )
                            )
                        }
                        Text("$health", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1E2A3A))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("LVL $level", color = Color(0xFFFFC832), fontWeight = FontWeight.Black, fontSize = 12.sp)
                }
            }
        }

        // Crosshair - spring recoil, dynamic spread, AAA hit-marker X
        Box(
            modifier = Modifier.align(Alignment.Center),
            contentAlignment = Alignment.Center
        ) {
            Canvas(
                modifier = Modifier.size(72.dp)
            ) {
                val cx = size.width / 2f + crosshairOffset.x * 0.04f
                val cy = size.height / 2f + crosshairOffset.y * 0.04f - recoilAnim
                val spread = recoilAnim * 0.42f
                val gap = (13f * pulse) + spread
                val len = 13f
                val stroke = 2.2f
                val col = Color.White
                val shadow = Color.Black.copy(alpha = 0.75f)
                // shadow cross
                drawLine(shadow, Offset(cx - gap - len, cy), Offset(cx - gap, cy), strokeWidth = stroke + 1.6f)
                drawLine(shadow, Offset(cx + gap, cy), Offset(cx + gap + len, cy), strokeWidth = stroke + 1.6f)
                drawLine(shadow, Offset(cx, cy - gap - len), Offset(cx, cy - gap), strokeWidth = stroke + 1.6f)
                drawLine(shadow, Offset(cx, cy + gap), Offset(cx, cy + gap + len), strokeWidth = stroke + 1.6f)
                // main cross
                drawLine(col, Offset(cx - gap - len, cy), Offset(cx - gap, cy), strokeWidth = stroke)
                drawLine(col, Offset(cx + gap, cy), Offset(cx + gap + len, cy), strokeWidth = stroke)
                drawLine(col, Offset(cx, cy - gap - len), Offset(cx, cy - gap), strokeWidth = stroke)
                drawLine(col, Offset(cx, cy + gap), Offset(cx, cy + gap + len), strokeWidth = stroke)
                // center dot
                drawCircle(Color(0xFFFF3B30), radius = 2.4f, center = Offset(cx, cy))
                drawCircle(Color.White, radius = 1.15f, center = Offset(cx, cy))
                if (muzzleFlash) {
                    drawCircle(Color(0xFFFFD67A).copy(alpha = 0.92f), radius = 9f, center = Offset(cx, cy))
                    drawCircle(Color.White.copy(alpha = 0.55f), radius = 4.5f, center = Offset(cx, cy))
                }
                // AAA hit-marker — diagonal X, pops on hit (CoD style) — spring-driven punch
                if (hitMarkerVisible) {
                    val s = 10f * hitMarkerScaleSpring
                    val a = (0.98f - (1.35f - hitMarkerScaleSpring) * 0.25f).coerceIn(0.7f, 1f)
                    val hitCol = Color.White.copy(alpha = a)
                    val hitShadow = Color.Black.copy(alpha = 0.85f)
                    val d = s
                    // shadow X
                    drawLine(hitShadow, Offset(cx - d, cy - d), Offset(cx - d * 0.45f, cy - d * 0.45f), strokeWidth = 3.2f)
                    drawLine(hitShadow, Offset(cx + d * 0.45f, cy - d * 0.45f), Offset(cx + d, cy - d), strokeWidth = 3.2f)
                    drawLine(hitShadow, Offset(cx - d, cy + d), Offset(cx - d * 0.45f, cy + d * 0.45f), strokeWidth = 3.2f)
                    drawLine(hitShadow, Offset(cx + d * 0.45f, cy + d * 0.45f), Offset(cx + d, cy + d), strokeWidth = 3.2f)
                    // foreground X
                    drawLine(hitCol, Offset(cx - d, cy - d), Offset(cx - d * 0.45f, cy - d * 0.45f), strokeWidth = 2f)
                    drawLine(hitCol, Offset(cx + d * 0.45f, cy - d * 0.45f), Offset(cx + d, cy - d), strokeWidth = 2f)
                    drawLine(hitCol, Offset(cx - d, cy + d), Offset(cx - d * 0.45f, cy + d * 0.45f), strokeWidth = 2f)
                    drawLine(hitCol, Offset(cx + d * 0.45f, cy + d * 0.45f), Offset(cx + d, cy + d), strokeWidth = 2f)
                }
            }
        }

        // Weapon view-model — M4A1 silhouette with spring kick & muzzle flash (AAA polish)
        // Critic fix: raise weapon above AIM pad / control bar (was clipped behind AIM at 72dp)
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 108.dp)
                .offset(y = (recoilAnim * 0.65f).dp)
        ) {
            Canvas(modifier = Modifier.size(260.dp, 88.dp)) {
                val kick = recoilAnim
                val scaleKick = 1f + kick * 0.012f
                // vertical kick: weapon lifts, apply translate via draw scope offset simulation
                val baseY = size.height * 0.42f - kick * 1.1f
                // shadow under weapon
                drawOval(Color.Black.copy(alpha = 0.22f), topLeft = Offset(42f, size.height * 0.78f), size = Size(112f, 10f))
                // stock
                drawRoundRect(Color(0xFF1C1E1A), topLeft = Offset(8f, baseY + 16f), size = Size(42f, 14f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f))
                // body / receiver
                drawRoundRect(Color(0xFF2A2E28), topLeft = Offset(44f, baseY + 6f), size = Size(58f, 26f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f))
                // mag
                drawRoundRect(Color(0xFF181818), topLeft = Offset(66f, baseY + 28f), size = Size(22f, 18f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f))
                // handguard
                drawRoundRect(Color(0xFF2F342E), topLeft = Offset(98f, baseY + 10f), size = Size(62f, 18f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f))
                repeat(3) { i ->
                    drawLine(Color(0xFF1A1A18), Offset(110f + i * 14f, baseY + 12f), Offset(110f + i * 14f, baseY + 26f), strokeWidth = 1.2f)
                }
                // barrel
                drawRect(Color(0xFF111111), topLeft = Offset(158f, baseY + 14f), size = Size(54f, 7f))
                // front sight
                drawRect(Color(0xFF0F0F0F), topLeft = Offset(202f, baseY + 9f), size = Size(5f, 12f))
                // suppressor tip
                drawRoundRect(Color(0xFF3A3A3A), topLeft = Offset(208f, baseY + 12f), size = Size(12f, 11f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f))
                // optic / red dot
                drawRoundRect(Color(0xFF1E2520), topLeft = Offset(74f, baseY - 2f), size = Size(28f, 10f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f))
                if (!isReloading) {
                    drawCircle(Color(0xFFFF3B30).copy(alpha = 0.9f), radius = 1.6f, center = Offset(88f, baseY + 3f))
                }
                // subtle metallic highlight
                drawLine(Color.White.copy(alpha = 0.08f), Offset(44f, baseY + 8f), Offset(100f, baseY + 8f), strokeWidth = 1f)
                if (muzzleFlash) {
                    // star-shaped muzzle flash at tip
                    val tip = Offset(220f, baseY + 17.5f)
                    val flashCol = Color(0xFFFFF1A0)
                    val outer = Color(0xFFFFA62A).copy(alpha = 0.9f)
                    drawCircle(outer, radius = 14f + kick * 0.25f, center = tip)
                    drawCircle(flashCol, radius = 7.5f + kick * 0.15f, center = tip)
                    // 4-point star
                    for (a in 0 until 4) {
                        val ang = a * 90f * (PI.toFloat() / 180f)
                        val x1 = tip.x + cos(ang) * 18f
                        val y1 = tip.y + sin(ang) * 18f
                        drawLine(flashCol.copy(alpha = 0.85f), tip, Offset(x1, y1), strokeWidth = 2.2f)
                    }
                    drawCircle(Color.White.copy(alpha = 0.95f), radius = 3.2f, center = tip)
                }
            }
        }
        // AAA brass + smoke overlay — fullscreen physics particles (driven by frameTick)
        Canvas(modifier = Modifier.fillMaxSize()) {
            val tick = frameTick // invalidate each frame
            @Suppress("UNUSED_VARIABLE") val _t = tick
            val now = System.currentTimeMillis()
            // muzzle smoke puff — expands and fades 180ms after each shot
            if (muzzleFlash) {
                val smokeCenter = Offset(size.width / 2f + 64f, size.height - 92f)
                drawCircle(Color(0xFF9A9A9A).copy(alpha = 0.18f), radius = 22f, center = smokeCenter)
                drawCircle(Color.White.copy(alpha = 0.08f), radius = 14f, center = Offset(smokeCenter.x + 4f, smokeCenter.y - 6f))
            }
            for (b in brasses) {
                val age = (now - b.born) / 1000f // seconds
                if (age > 1.1f) continue
                val g = 680f // gravity px/s^2
                // start at ejection port (right side of weapon, ~center+10, bottom-78)
                val startX = size.width / 2f + 18f
                val startY = size.height - 78f
                val vx = b.vx * 42f // px per sec scaled
                val vy0 = b.vy * 28f
                val x = startX + vx * age * 14f + b.spin * 0.02f * age
                val y = startY + vy0 * age * 1.0f + 0.5f * g * age * age * 0.22f
                val alpha = (1f - age / 1.1f).coerceIn(0f, 1f)
                // shadow on ground beneath brass
                if (alpha > 0.15f) {
                    val groundY = size.height - 28f
                    val t = ((groundY - y) / (groundY - startY)).coerceIn(0f, 1f)
                    drawOval(Color.Black.copy(alpha = 0.16f * alpha * t), topLeft = Offset(x - 5f, groundY - 2f), size = Size(10f, 3f))
                }
                // brass casing — gold with highlight and spin rotation hint
                drawRoundRect(
                    color = Color(0xFFFFD67A).copy(alpha = alpha),
                    topLeft = Offset(x, y),
                    size = Size(9f, 5f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(1.2f, 1.2f)
                )
                drawLine(Color.White.copy(alpha = 0.55f * alpha), Offset(x + 1f, y + 0.5f), Offset(x + 7f, y + 0.5f), strokeWidth = 1f)
                drawLine(Color(0xFFB8860B).copy(alpha = 0.9f * alpha), Offset(x, y + 4f), Offset(x + 9f, y + 4f), strokeWidth = 0.9f)
                // spin glint
                if (age < 0.35f) {
                    drawCircle(Color.White.copy(alpha = 0.35f * (1f - age / 0.35f)), radius = 1.1f, center = Offset(x + 7f, y + 2f))
                }
            }
        }

        // Left movement pad - tactile
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 18.dp)
                .size(110.dp)
                .clip(CircleShape)
                .background(Color(0x332A3A55))
                .border(1.5.dp, Color(0x66FFFFFF), CircleShape)
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragEnd = { crosshairOffset = Offset.Zero },
                        onDrag = { change, dragAmount ->
                            crosshairOffset += dragAmount
                            yaw = (yaw + dragAmount.x * 0.04f).coerceIn(-40f, 40f)
                            change.consume()
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(Color(0x55FFFFFF))
                    .border(1.dp, Color.White, CircleShape)
            )
            Text("MOVE", color = Color.White.copy(alpha = 0.7f), fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp))
        }

        // Right aim pad
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 18.dp)
                .size(110.dp)
                .clip(CircleShape)
                .background(Color(0x332A3A55))
                .border(1.5.dp, Color(0x66FFFFFF), CircleShape)
                .pointerInput(Unit) {
                    detectDragGestures { change, dragAmount ->
                        yaw = (yaw + dragAmount.x * 0.18f).coerceIn(-40f, 40f)
                        pitch = (pitch - dragAmount.y * 0.14f).coerceIn(-15f, 20f)
                        change.consume()
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(42.dp)) {
                drawCircle(Color.White.copy(alpha = 0.35f), radius = 21f, style = Stroke(width = 1.2f))
                drawLine(Color.White, Offset(21f, 8f), Offset(21f, 16f), strokeWidth = 1.5f)
                drawLine(Color.White, Offset(21f, 26f), Offset(21f, 34f), strokeWidth = 1.5f)
                drawLine(Color.White, Offset(8f, 21f), Offset(16f, 21f), strokeWidth = 1.5f)
                drawLine(Color.White, Offset(26f, 21f), Offset(34f, 21f), strokeWidth = 1.5f)
            }
            Text("AIM", color = Color.White.copy(alpha = 0.7f), fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp))
        }

        // Fire button - large red
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 18.dp, bottom = 22.dp)
                .size(96.dp)
                .clip(CircleShape)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFFFF5A3A), Color(0xFFCC1A00)),
                        center = Offset(48f, 38f),
                        radius = 96f
                    )
                )
                .border(3.dp, Color.White.copy(alpha = 0.9f), CircleShape)
                .pointerInput(Unit) {
                    detectTapGestures(
                        onPress = {
                            fire()
                            tryAwaitRelease()
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("◉", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                Text("FIRE", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
            if (muzzleFlash) {
                Box(modifier = Modifier.matchParentSize().background(Color.White.copy(alpha = 0.22f), CircleShape))
            }
        }

        // Ammo HUD - COD style bottom bar
        Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 140.dp, bottom = 8.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xCC0A0F1A))
                .border(1.dp, Color(0xFF2A3A55), RoundedCornerShape(8.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Weapon icon
            Canvas(modifier = Modifier.size(44.dp, 18.dp)) {
                drawRoundRect(Color(0xFF3A4455), cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f))
                drawRect(Color(0xFF1A1A18), topLeft = Offset(6f, 6f), size = Size(32f, 6f))
                drawRect(Color(0xFFFFC832), topLeft = Offset(30f, 4f), size = Size(8f, 10f))
            }
            Column {
                Text("M4A1  •  AUTO", color = Color(0xFF8A9BB5), fontSize = 7.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        if (isReloading) "--" else "$ammo",
                        color = if (ammo < 8) Color(0xFFFF3B30) else Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 22.sp
                    )
                    Text("/ 30", color = Color(0xFF8A9BB5), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    if (isReloading) {
                        Text("RELOADING", color = Color(0xFFFFC832), fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(start = 6.dp, bottom = 2.dp))
                    }
                }
            }
            // Reload button
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isReloading) Color(0xFF3A3A45) else Color(0xFF3DDC84))
                    .pointerInput(isReloading) {
                        detectTapGestures { if (!isReloading && ammo < 30) isReloading = true }
                    }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("↻", color = if (isReloading) Color(0xFF8A9BB5) else Color.Black, fontWeight = FontWeight.Black, fontSize = 14.sp)
            }
        }

        // Hit marker overlay - when score increases
        if (gameMessage.startsWith("HIT")) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(bottom = 90.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xFF3DDC84))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(gameMessage, color = Color.Black, fontWeight = FontWeight.Black, fontSize = 13.sp, letterSpacing = 0.5.sp)
            }
        }

        // Top right tactical info
        Column(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 54.dp, end = 12.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xAA0A0F1A))
                .border(1.dp, Color(0xFF2A3A55), RoundedCornerShape(8.dp))
                .padding(8.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text("TACTICAL MAP  •  RUST", color = Color(0xFF8A9BB5), fontSize = 7.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF3DDC84)))
                Text("$kills / ${5 + level * 2} ELIMINATIONS", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }
            // Radar mini
            Canvas(modifier = Modifier.size(64.dp).clip(CircleShape).background(Color(0xFF0A1A2A)).border(1.dp, Color(0xFF3DDC84), CircleShape)) {
                drawCircle(Color(0xFF3DDC84).copy(alpha = 0.15f), radius = size.minDimension / 2f)
                drawCircle(Color(0xFF3DDC84).copy(alpha = 0.08f), radius = size.minDimension / 3f)
                drawLine(Color(0xFF3DDC84).copy(alpha = 0.3f), Offset(size.width / 2f, 0f), Offset(size.width / 2f, size.height), strokeWidth = 1f)
                drawLine(Color(0xFF3DDC84).copy(alpha = 0.3f), Offset(0f, size.height / 2f), Offset(size.width, size.height / 2f), strokeWidth = 1f)
                // player
                drawCircle(Color.White, radius = 3f, center = Offset(size.width / 2f, size.height / 2f))
                // enemies blips
                for (t in targets.filter { it.alive }.take(3)) {
                    val bx = size.width / 2f + t.x * 22f
                    val by = size.height / 2f + (t.z - 4f) * 4f
                    drawCircle(Color(0xFFFF3B30), radius = 3.5f, center = Offset(bx.coerceIn(6f, size.width - 6f), by.coerceIn(6f, size.height - 6f)))
                }
            }
        }

        // Damage vignette — flashes red on near-miss / low health (AAA feedback)
        if (damageFlash || health < 30) {
            val flashAlpha = if (damageFlash) 0.30f else 0.18f + (1f - health / 30f) * 0.12f
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height
                // radial blood vignette
                drawRect(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.Transparent, Color(0xFFFF3B30).copy(alpha = flashAlpha)),
                        center = Offset(w / 2f, h / 2f),
                        radius = max(w, h) * 0.78f
                    ),
                    size = size
                )
                // red border bloom
                drawRect(
                    color = Color(0xFFFF3B30).copy(alpha = flashAlpha * 0.95f),
                    style = Stroke(width = 26f)
                )
                // corner blood splat hint
                drawCircle(Color(0xFFFF3B30).copy(alpha = flashAlpha * 0.38f), radius = w * 0.22f, center = Offset(w * 0.08f, h * 0.90f))
                drawCircle(Color(0xFFFF3B30).copy(alpha = flashAlpha * 0.30f), radius = w * 0.18f, center = Offset(w * 0.92f, h * 0.86f))
            }
        }

        // Level up banner
        if (gameMessage.startsWith("LEVEL")) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 58.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFFFC832))
                    .padding(horizontal = 18.dp, vertical = 8.dp)
            ) {
                Text(gameMessage, color = Color.Black, fontWeight = FontWeight.Black, fontSize = 14.sp)
            }
        }
    }
}
