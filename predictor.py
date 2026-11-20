from pathlib import Path
from threading import Lock
import pickle

import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.utils import pad_sequences


# Output order from emotion_dataset["train"].features["label"].names.
EMOTIONS = ("sadness", "joy", "love", "anger", "fear", "surprise")


class NoTokensError(ValueError):
    """The sentence contained no tokens after preprocessing."""


class EmotionClassifier:
    def __init__(self, model_dir: Path):
        self.model = load_model(model_dir / "BiGRU_Modle.keras", compile=False)
        # This is the local tokenizer exported by the training notebook.
        with (model_dir / "tokenizer.pkl").open("rb") as stream:
            self.tokenizer = pickle.load(stream)

        self.max_tokens = int(self.model.input_shape[-1])
        if self.model.output_shape[-1] != len(EMOTIONS):
            raise ValueError("The model output size does not match the emotion labels.")
        self.inference_lock = Lock()

    def predict(self, text: str) -> dict:
        # Use the fitted tokenizer's own lowercase, filter and OOV settings.
        token_ids = self.tokenizer.texts_to_sequences([text])[0]
        if not token_ids:
            raise NoTokensError("Please enter a sentence containing at least one word.")

        inputs = pad_sequences(
            [token_ids], maxlen=self.max_tokens, padding="post", truncating="post"
        )
        with self.inference_lock:
            scores = np.asarray(self.model(inputs, training=False))[0]

        winner = int(np.argmax(scores))
        return {
            "text": text,
            "predicted_emotion": EMOTIONS[winner],
            "confidence": float(scores[winner]),
            "probabilities": dict(zip(EMOTIONS, map(float, scores))),
            "token_count": len(token_ids),
            "tokens_used": min(len(token_ids), self.max_tokens),
            "max_tokens": self.max_tokens,
        }
