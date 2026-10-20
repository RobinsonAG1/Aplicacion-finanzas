from app.schemas.common import CamelModel


class ImportRowError(CamelModel):
    row: int
    message: str


class ImportSummary(CamelModel):
    total: int
    imported: int
    skipped: int
    errors: list[ImportRowError]


class ImportResponse(CamelModel):
    data: ImportSummary
