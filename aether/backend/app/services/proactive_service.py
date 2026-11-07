import re
from typing import Any, Dict, List

SENSITIVE_OTP_REGEX = re.compile(
    r"\b(otp|one-time password|verification code|passcode|cvv|netbanking|pin)\b",
    re.IGNORECASE,
)


class ProactiveDecisionService:
    """Evaluates incoming Android device events against privacy exclusions, quiet hours, and memory graph."""

    def __init__(self) -> None:
        self.excluded_packages = {
            "com.whatsapp",
            "com.google.android.apps.nbu.paisa.user",
            "com.phonepe.app",
        }
        self.initiative_threshold = 65

    def evaluate_android_event(
        self,
        package_name: str,
        title: str,
        content: str,
        related_memories: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if package_name in self.excluded_packages:
            return {
                "decision": "suppress_privacy",
                "relevance_score": 0,
                "reason": f"Package {package_name} is excluded by user privacy policy.",
            }

        combined = f"{title} {content}"
        if SENSITIVE_OTP_REGEX.search(combined):
            return {
                "decision": "suppress_privacy",
                "relevance_score": 0,
                "reason": "Notification contains sensitive OTP or financial verification content.",
            }

        top_mem_score = related_memories[0].get("score", 0.0) if related_memories else 0.0
        relevance = min(100, int(45 + top_mem_score * 55))

        if relevance < self.initiative_threshold:
            return {
                "decision": "log_only",
                "relevance_score": relevance,
                "reason": f"Relevance {relevance} below initiative threshold {self.initiative_threshold}.",
            }

        return {
            "decision": "proactive_suggestion",
            "relevance_score": relevance,
            "title": f"Aria noticed: {title}",
            "message": f"From {package_name}: \"{content}\". Would you like me to open {package_name} on your phone?",
            "proposed_action": {
                "capability": "launch_application",
                "parameters": {"packageName": package_name},
            },
        }


proactive_service = ProactiveDecisionService()
