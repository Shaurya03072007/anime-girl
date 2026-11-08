import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.main import app


class TestAetherBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        resp = self.client.get("/api/v1/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn(
            data["live_model"],
            (
                "gemini-3.8-live",
                "gemini-3.8-live-extended-thinking",
                "gemini-2.5-flash-native-audio-preview-12-2025",
            ),
        )
        self.assertEqual(data["ghost_choreography_model"], "gemma-4-31b-it")
        self.assertGreaterEqual(data["memories_count"], 5)

    def test_hybrid_memory_retrieval_and_consolidation(self):
        resp = self.client.get("/api/v1/memories?q=pgvector+Ananya+PR")
        self.assertEqual(resp.status_code, 200)
        memories = resp.json()["memories"]
        self.assertGreaterEqual(len(memories), 1)
        self.assertIn("Ananya", memories[0]["content"])
        self.assertIn("scoreBreakdown", memories[0])

        create_resp = self.client.post(
            "/api/v1/memories",
            json={
                "content": "Shaurya prefers dark-first Jetpack Compose themes with 60fps anime kinematics.",
                "category": "procedural",
                "epistemic_status": "explicitly_stated",
                "importance": 0.91,
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        created = create_resp.json()
        self.assertIn(created["action"], ("created", "merged_duplicate"))
        mem_id = created["memory"]["id"]

        patch_resp = self.client.patch(
            f"/api/v1/memories/{mem_id}",
            json={"verification_status": "verified"},
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["memory"]["verification_status"], "verified")

    def test_proactive_privacy_filter_blocks_otp_and_excluded_apps(self):
        otp_resp = self.client.post(
            "/api/v1/device/event",
            json={
                "user_id": "shaurya",
                "event_type": "notification_posted",
                "package_name": "com.android.mms",
                "title": "Bank Verification",
                "content": "Your one-time password OTP is 492811. Do not share.",
            },
        )
        self.assertEqual(otp_resp.status_code, 200)
        self.assertEqual(otp_resp.json()["decision"], "suppress_privacy")

        wa_resp = self.client.post(
            "/api/v1/device/event",
            json={
                "user_id": "shaurya",
                "event_type": "notification_posted",
                "package_name": "com.whatsapp",
                "title": "Personal Message",
                "content": "Hey, are we meeting at 7?",
            },
        )
        self.assertEqual(wa_resp.status_code, 200)
        self.assertEqual(wa_resp.json()["decision"], "suppress_privacy")

        gh_resp = self.client.post(
            "/api/v1/device/event",
            json={
                "user_id": "shaurya",
                "event_type": "notification_posted",
                "package_name": "com.github.android",
                "title": "Ananya Rao commented on Project Aether PR #42",
                "content": "pgvector HNSW index benchmark passed.",
            },
        )
        self.assertEqual(gh_resp.status_code, 200)
        self.assertEqual(gh_resp.json()["decision"], "proactive_suggestion")

    def test_companion_scene_and_character_customization(self):
        scene_resp = self.client.post(
            "/api/v1/companion/scene",
            json={"scene_id": "rooftop_balcony"},
        )
        self.assertEqual(scene_resp.status_code, 200)
        self.assertEqual(scene_resp.json()["life_state"]["activeSceneId"], "rooftop_balcony")

        char_resp = self.client.put(
            "/api/v1/character",
            json={"voiceName": "Kore", "currentAnimation": "Curious"},
        )
        self.assertEqual(char_resp.status_code, 200)
        self.assertEqual(char_resp.json()["character"]["voiceName"], "Kore")

    def test_3d_ghost_avatar_control_and_infer_behavior(self):
        ghost_resp = self.client.post(
            "/api/v1/companion/ghost",
            json={
                "behavior": "ceiling_hang_upside_down",
                "expression": "Curious",
                "target_x": 0.0,
                "target_y": 0.42,
                "depth_z": 0.25,
                "speed": 1.65,
                "glitch_intensity": 0.35,
            },
        )
        self.assertEqual(ghost_resp.status_code, 200)
        ghost_cmd = ghost_resp.json()["ghost_command"]
        self.assertEqual(ghost_cmd["behavior"], "ceiling_hang_upside_down")
        self.assertEqual(ghost_cmd["emotion"], "curious")

        conv_resp = self.client.post(
            "/api/v1/conversation/turn",
            json={"user_id": "shaurya", "text": "Rush right up to my screen glass and look at me!"},
        )
        self.assertEqual(conv_resp.status_code, 200)
        conv_data = conv_resp.json()
        self.assertIn("ghost_command", conv_data)
        self.assertEqual(conv_data["ghost_command"]["behavior"], "rush_to_glass")


if __name__ == "__main__":
    unittest.main()
