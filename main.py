from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from predictor import EmotionClassifier, NoTokensError


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "static"
MODEL_DIR = ROOT / "Models Exported"
log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.classifier = None
    try:
        app.state.classifier = EmotionClassifier(MODEL_DIR)
    except Exception:
        log.exception("Could not open the Toneprint model and tokenizer at %s", MODEL_DIR)
    yield
    app.state.classifier = None


app = FastAPI(title="Toneprint", version="1.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ASSETS), name="static")


class Sentence(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class Prediction(BaseModel):
    text: str
    predicted_emotion: str
    confidence: float
    probabilities: dict[str, float]
    token_count: int
    tokens_used: int
    max_tokens: int


class Health(BaseModel):
    model_loaded: bool
    max_tokens: int | None


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(ASSETS / "index.html")


@app.get("/health", response_model=Health)
def health(request: Request, response: Response):
    classifier = request.app.state.classifier
    if classifier is None:
        response.status_code = 503
        return Health(model_loaded=False, max_tokens=None)
    return Health(model_loaded=True, max_tokens=classifier.max_tokens)


@app.post("/predict", response_model=Prediction)
def predict(sentence: Sentence, request: Request):
    classifier = request.app.state.classifier
    if classifier is None:
        raise HTTPException(503, "The model is unavailable. Check the server terminal.")
    try:
        return classifier.predict(sentence.text)
    except NoTokensError as exc:
        raise HTTPException(422, str(exc)) from exc
