from datetime import datetime
from sqlalchemy import Table, Column, Integer, ForeignKey, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

# Many-to-Many Association Table between Commits and Files
commit_files = Table(
    "commit_files",
    Base.metadata,
    Column("commit_id", Integer, ForeignKey("commits.id", ondelete="CASCADE"), primary_key=True),
    Column("file_id", Integer, ForeignKey("files.id", ondelete="CASCADE"), primary_key=True),
)

class DBFile(Base):
    """
    Model representing a file in the codebase.
    """
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    last_modified: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    repo_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    # one file has many functions
    functions: Mapped[list["DBFunction"]] = relationship(
        back_populates="file", 
        cascade="all, delete-orphan", 
        passive_deletes=True  
    )
    
    classes: Mapped[list["DBClass"]] = relationship(
        back_populates="file", 
        cascade="all, delete-orphan", 
        passive_deletes=True
    )
    imports: Mapped[list["DBImport"]] = relationship(
        back_populates="file", 
        cascade="all, delete-orphan", 
        passive_deletes=True
    )
    commits: Mapped[list["DBCommit"]] = relationship(
        secondary=commit_files, 
        back_populates="files"
    )

    def __repr__(self) -> str:
        return f"<DBFile(id={self.id}, path='{self.path}', language='{self.language}')>"


class DBFunction(Base):
    """
    Model representing a function or method definition.
    """
    __tablename__ = "functions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    source_code: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship back to File
    file: Mapped["DBFile"] = relationship(back_populates="functions")

    def __repr__(self) -> str:
        return f"<DBFunction(id={self.id}, name='{self.name}', lines={self.start_line}-{self.end_line})>"


class DBClass(Base):
    """
    Model representing a class definition.
    """
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationship back to File
    file: Mapped["DBFile"] = relationship(back_populates="classes")

    def __repr__(self) -> str:
        return f"<DBClass(id={self.id}, name='{self.name}', lines={self.start_line}-{self.end_line})>"


class DBImport(Base):
    """
    Model representing an import statement in a file.
    """
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    imported_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_module: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationship back to File
    file: Mapped["DBFile"] = relationship(back_populates="imports")

    def __repr__(self) -> str:
        return f"<DBImport(id={self.id}, name='{self.imported_name}', from='{self.source_module}')>"


class DBCommit(Base):
    """
    Model representing a Git commit.
    """
    __tablename__ = "commits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hash: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship to Files touched by this commit
    files: Mapped[list["DBFile"]] = relationship(
        secondary=commit_files, 
        back_populates="commits"
    )

    def __repr__(self) -> str:
        return f"<DBCommit(id={self.id}, hash='{self.hash[:7]}', author='{self.author}')>"
