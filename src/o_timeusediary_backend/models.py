from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy.dialects.postgresql import JSONB
from pydantic import model_validator, ConfigDict
import uuid

# Study table (internal models - no case conversion needed)
class StudyBase(SQLModel):
    name: str = Field(index=True, unique=True)
    name_short: str = Field(index=True, unique=True)
    description: Optional[str] = None

class Study(StudyBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_names: List["StudyEntryName"] = Relationship(back_populates="study")

# Study entry names mapping table
class StudyEntryNameBase(SQLModel):
    entry_index: int = Field(ge=0)
    entry_name: str

class StudyEntryName(StudyEntryNameBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    study_id: int = Field(foreign_key="study.id", index=True)
    study: Study = Relationship(back_populates="entry_names")

    class Config:
        unique_together = [("study_id", "entry_index"), ("study_id", "entry_name")]

# Study API models
class StudyEntryNameCreate(StudyEntryNameBase):
    pass

class StudyEntryNameRead(StudyEntryNameBase):
    id: int

class StudyCreate(StudyBase):
    entry_names: Optional[List[StudyEntryNameCreate]] = None

class StudyRead(StudyBase):
    id: int
    entry_names: List[StudyEntryNameRead]

# Table model for activities (database - snake_case)
class TimelineActivityBase(SQLModel):
    timeline_key: str = Field(index=True)
    activity: str = Field(index=True)
    category: str = Field(index=True)
    start_time: str
    end_time: str
    block_length: int = Field(ge=0)
    color: str
    parent_activity: str
    is_custom_input: bool
    original_selection: str
    start_minutes: int = Field(ge=0, le=1440)
    end_minutes: int = Field(ge=0, le=1440)
    mode: str = Field(index=True)
    count: int = Field(ge=1)
    frontend_activity_id: str = Field(index=True)

class TimelineActivity(TimelineActivityBase, table=True):
    id: Optional[str] = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True
    )
    timeuse_entry_id: str = Field(foreign_key="timeuseentry.id", index=True)
    selections: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB)
    )
    available_options: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB)
    )

class TimelineActivityCreate(SQLModel):
    timeline_key: str
    activity: str
    category: str
    start_time: str
    end_time: str
    block_length: int
    color: str
    parent_activity: str
    is_custom_input: bool
    original_selection: str
    start_minutes: int
    end_minutes: int
    mode: str
    selections: Optional[Dict[str, Any]] = None
    available_options: Optional[Dict[str, Any]] = Field(default=None)
    count: int
    frontend_activity_id: str

    model_config = ConfigDict(
        extra='forbid'
    )

    @model_validator(mode='after')
    def validate_count_based_on_mode(self):
        mode = self.mode
        count = self.count
        selections = self.selections

        if mode == 'single-choice':
            if count != 1:
                raise ValueError('Count must be 1 for single-choice activities')
            if selections is not None:
                raise ValueError('Selections must be null for single-choice activities')
        elif mode == 'multiple-choice':
            if selections is None:
                raise ValueError('Selections cannot be null for multiple-choice activities')
            expected_count = len(selections) if isinstance(selections, (list, dict)) else 0
            if count != expected_count:
                raise ValueError(f'Count must match number of selections. Expected {expected_count}, got {count}')
        else:
            raise ValueError(f'Invalid mode: {mode}')

        return self

    @model_validator(mode='after')
    def validate_available_options(self):
        if self.mode == 'multiple-choice' and self.available_options is None:
            raise ValueError('available_options must be provided for multiple-choice activities')
        return self

class StudyMetadata(SQLModel):
    study_name: str = Field(..., min_length=1)
    daily_entry_index: int = Field(..., ge=0)


class ParticipantMetadata(SQLModel):
    pid: str = Field(..., min_length=1)

class TimelineMetadata(SQLModel):
    study: StudyMetadata
    participant: ParticipantMetadata


    @model_validator(mode='after')
    def validate_required_metadata(self):
        if not self.study or not self.participant:
            raise ValueError('Study and participant metadata are required')
        return self

class TimeuseEntryCreate(SQLModel):
    activities: List[TimelineActivityCreate] = Field(..., min_items=1)
    entry_metadata: TimelineMetadata

    model_config = ConfigDict(
        extra='forbid'
    )

    @model_validator(mode='after')
    def validate_activities_non_empty(self):
        if not self.activities:
            raise ValueError('At least one activity must be provided')
        return self

    @property
    def study_name_short(self) -> str:
        return self.entry_metadata.study.study_name

    @property
    def daily_entry_index(self) -> int:
        return self.entry_metadata.study.daily_entry_index

class TimelineActivityResponse(SQLModel):
    timeline_key: str
    activity: str
    category: str
    start_time: str
    end_time: str
    block_length: int
    color: str
    parent_activity: str
    is_custom_input: bool
    original_selection: str
    start_minutes: int
    end_minutes: int
    mode: str
    selections: Optional[Dict[str, Any]] = None
    available_options: Optional[Dict[str, Any]] = Field(default=None)
    count: int
    frontend_activity_id: str

    model_config = ConfigDict(
        from_attributes=True
    )

class StudyMetadataResponse(SQLModel):
    study_name: str
    daily_entry_index: int

    model_config = ConfigDict(
        from_attributes=True
    )

class ParticipantMetadataResponse(SQLModel):
    pid: str

    model_config = ConfigDict(from_attributes=True)

class TimelineMetadataResponse(SQLModel):
    study: StudyMetadataResponse
    participant: ParticipantMetadataResponse

    model_config = ConfigDict(from_attributes=True)

class TimeuseEntryRead(SQLModel):
    id: str
    participant_id: str
    study_id: int
    daily_entry_index: int
    submitted_at: datetime
    activities: List[TimelineActivityResponse]
    entry_metadata: TimelineMetadataResponse
    raw_data: Optional[Dict[str, Any]] = Field(default=None)
    study: StudyRead
    entry_name: str

    model_config = ConfigDict(
        from_attributes=True
    )

# Main entry models (internal)
class TimeuseEntryBase(SQLModel):
    participant_id: str = Field(index=True)
    study_id: int = Field(foreign_key="study.id", index=True)
    daily_entry_index: int = Field(ge=0, index=True)
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

class TimeuseEntry(TimeuseEntryBase, table=True):
    id: Optional[str] = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True
    )
    raw_data: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB)
    )
    entry_metadata_json: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB)
    )

    class Config:
        unique_together = [("participant_id", "study_id", "daily_entry_index")]

class TimeuseEntryUpdate(SQLModel):
    participant_id: Optional[str] = None
    study_id: Optional[int] = None
    daily_entry_index: Optional[int] = None
    entry_metadata_json: Optional[Dict[str, Any]] = None